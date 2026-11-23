import { readFile } from 'node:fs/promises'
import type { Readable } from 'node:stream'
import type { FileInput } from '@kisaki3/desktop-contracts/resources'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import decodeIco from 'decode-ico'
import type sharp from 'sharp'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseImageTransform,
  type ImageFormat,
  type ImagesApi,
} from '@kisaki3/desktop-contracts/images'
import type { createAttachments } from './attachments'
import type { createResources } from './resources'
import type { StagedFile } from './files'

/** Processing budgets include every decoded frame and all waiting operations. */
const imageLimits = { bytes: 64 * 1024 * 1024, pixels: 48_000_000, concurrent: 2, waiting: 8 }

/** Checks source and intermediate decoded dimensions before allocating pixel storage. */
function checkPixels(width: number, height: number, pages = 1) {
  if (width * height * pages > imageLimits.pixels) {
    throw new DesktopError('ResourceLimit', 'The image exceeds the 48 megapixel decoding limit')
  }
}

/** Reads each icon directory entry separately so an invalid layer cannot hide a valid larger image. */
async function iconPng(bytes: Buffer, engine: typeof sharp) {
  const count = bytes.readUInt16LE(4)
  let best: { area: number; bpp: number; png: Buffer } | undefined
  let totalPixels = 0
  for (let i = 0; i < count; i++) {
    const entry = 6 + 16 * i
    if (entry + 16 > bytes.length) {
      throw new DesktopError('InvalidInput', 'The icon directory is incomplete')
    }
    const offset = bytes.readUInt32LE(entry + 12)
    const size = bytes.readUInt32LE(entry + 8)
    if (size < 16 || offset + size > bytes.length) {
      continue
    }
    const data = bytes.subarray(offset, offset + size)
    try {
      const png = data.readUInt32BE(0) === 0x89504e47
      const width = png ? data.readUInt32BE(16) : Math.abs(data.readInt32LE(4))
      const height = png ? data.readUInt32BE(20) : Math.abs(data.readInt32LE(8)) / 2
      totalPixels += width * height
      checkPixels(totalPixels, 1)
      const single = Buffer.concat([bytes.subarray(0, 6), bytes.subarray(entry, entry + 16), data])
      single.writeUInt16LE(1, 4)
      single.writeUInt32LE(22, 18)
      const layer = decodeIco(single)[0]!
      const image =
        layer.type === 'png'
          ? engine(layer.data, { limitInputPixels: imageLimits.pixels })
          : engine(Buffer.from(layer.data), {
              raw: { width: layer.width, height: layer.height, channels: 4 },
            })
      const out = await image.png().toBuffer({ resolveWithObject: true })
      const area = out.info.width * out.info.height
      if (!best || area > best.area || (area === best.area && layer.bpp > best.bpp)) {
        best = { area, bpp: layer.bpp, png: out.data }
      }
    } catch (error) {
      if (error instanceof DesktopError) {
        throw error
      }
    }
  }
  if (!best) {
    throw new DesktopError('InvalidInput', 'The icon contains no readable image layer')
  }
  return best.png
}

/** Creates image operations using the exact native runtime deployed alongside this application. */
export function createImages(
  runtime: string,
  attachments: ReturnType<typeof createAttachments>,
  resources: ReturnType<typeof createResources>,
): Omit<ImagesApi, 'prepare'> & {
  /** Prepares a verified image from an admitted input stream or file source. */
  prepare(input: FileInput | Readable, options?: CallOptions): ReturnType<ImagesApi['prepare']>
} {
  const engine = createRequire(join(runtime, 'media', 'index.cjs'))('sharp') as typeof sharp
  const waiting = new Set<() => void>()
  let running = 0

  /** Acquires capacity before reading or decoding bytes; queued callers retain cancellation. */
  async function work<T>(signal: AbortSignal | undefined, run: () => Promise<T>) {
    signal?.throwIfAborted()
    if (running >= imageLimits.concurrent) {
      if (waiting.size >= imageLimits.waiting) {
        throw new DesktopError('Busy', 'The image processing queue is full')
      }
      await new Promise<void>((resolve, reject) => {
        const next = () => {
          signal?.removeEventListener('abort', cancel)
          resolve()
        }
        const cancel = () => {
          waiting.delete(next)
          reject(signal!.reason)
        }
        waiting.add(next)
        signal?.addEventListener('abort', cancel, { once: true })
      })
    } else {
      running++
    }
    try {
      signal?.throwIfAborted()
      return await run()
    } finally {
      const next = waiting.values().next().value
      if (next) {
        waiting.delete(next)
        next()
      } else {
        running--
      }
    }
  }

  /** Validates all decoded frames before exposing the prepared content. */
  async function publish(stage: StagedFile, bytes: Buffer, signal?: AbortSignal) {
    let converted: StagedFile | undefined
    try {
      const originalIco = bytes.length >= 6 && bytes.readUInt32LE(0) === 0x00010000
      if (originalIco) {
        bytes = await iconPng(bytes, engine)
      }
      const image = engine(bytes, {
        animated: true,
        limitInputPixels: imageLimits.pixels,
        failOn: 'warning',
      })
      const meta = await image.metadata()
      const format = meta.format === 'heif' && meta.compression === 'av1' ? 'avif' : meta.format
      if (!['jpeg', 'png', 'webp', 'gif', 'avif', 'svg'].includes(format)) {
        throw new DesktopError('InvalidInput', 'Unsupported image format')
      }
      const frames = meta.pages ?? 1
      const frameHeight = meta.pageHeight ?? meta.height
      checkPixels(meta.width, frameHeight, frames)
      await image.stats()
      signal?.throwIfAborted()
      let resultFormat: ImageFormat = format as ImageFormat
      if (format === 'svg' || originalIco) {
        const output = format === 'svg' ? await image.png().toBuffer() : bytes
        converted = await attachments.stage(
          { type: 'bytes', bytes: output },
          imageLimits.bytes,
          signal,
        )
        resultFormat = 'png'
      }
      const transposed = !!meta.orientation && meta.orientation >= 5
      const width = transposed ? frameHeight : meta.width
      const height = transposed ? meta.width : frameHeight
      const content = await attachments.prepare(
        converted ?? stage,
        'image/' + resultFormat,
        width,
        height,
      )
      return {
        attachmentId: content.metadata.id,
        resource: content.resource,
        dispose: () => content.dispose(),
        width,
        height,
        format: resultFormat,
        frameCount: frames,
      }
    } finally {
      await converted?.dispose()
    }
  }

  return {
    prepare(input, options) {
      return work(options?.signal, async () => {
        const stage = await attachments.stage(input, imageLimits.bytes, options?.signal)
        try {
          return await publish(stage, await readFile(stage.path), options?.signal)
        } finally {
          await stage.dispose()
        }
      })
    },
    /** Keeps the source held through the ordered transform and PNG preparation. */
    async transform(ref, parameters, options) {
      const input = parseImageTransform(parameters)
      const hold = resources.hold(ref)
      try {
        return await work(options?.signal, async () => {
          const file = resources.file(hold.resource)
          if (!file.mediaType.startsWith('image/') || file.size > imageLimits.bytes) {
            throw new DesktopError('InvalidInput', 'Choose a prepared image')
          }
          const metadata = await engine(file.path).metadata()
          const frames = metadata.pages ?? 1
          if ((frames > 1 && input.frameIndex === undefined) || (input.frameIndex ?? 0) >= frames) {
            throw new DesktopError('InvalidInput', 'Select an existing image frame')
          }
          const first = await engine(file.path, {
            page: input.frameIndex ?? 0,
            limitInputPixels: imageLimits.pixels,
          })
            .autoOrient()
            .png()
            .toBuffer()
          let image = engine(first)
          if (input.flipVertical) {
            image = image.flip()
          }
          if (input.flipHorizontal) {
            image = image.flop()
          }
          if (input.rotationDegrees) {
            const angle = (input.rotationDegrees * Math.PI) / 180
            const { width, height } = await image.metadata()
            checkPixels(
              Math.ceil(Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle))),
              Math.ceil(Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle))),
            )
            image = image.rotate(input.rotationDegrees, {
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
          }
          if (input.crop) {
            image = engine(await image.png().toBuffer()).extract(input.crop)
          }
          const bytes = await image.png().toBuffer()
          const stage = await attachments.stage(
            { type: 'bytes', bytes },
            imageLimits.bytes,
            options?.signal,
          )
          try {
            return await publish(stage, bytes, options?.signal)
          } finally {
            await stage.dispose()
          }
        })
      } finally {
        await hold.dispose()
      }
    },
  }
}
