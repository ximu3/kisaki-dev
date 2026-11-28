import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type * as Libmpv from '@ximu3/libmpv-node'
import type { MpvValue } from '@ximu3/libmpv-node'
import type { VideoInformation } from '../../../shared/media-information'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

function maps(value: MpvValue): Record<string, MpvValue>[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter(
    (row): row is Record<string, MpvValue> =>
      typeof row === 'object' &&
      row !== null &&
      !Array.isArray(row) &&
      !(row instanceof Uint8Array),
  )
}
function text(value: MpvValue | undefined) {
  return typeof value === 'string' ? value : null
}
function number(value: MpvValue | undefined) {
  return typeof value === 'bigint' || typeof value === 'number' ? Number(value) : null
}

export async function inspectVideo(
  resources: string,
  path: string,
  signal: AbortSignal,
): Promise<VideoInformation> {
  signal.throwIfAborted()
  const before = await stat(path, { bigint: true })
  if (!before.isFile()) {
    throw new DesktopError('InvalidInput', 'Choose a video file')
  }
  const runtime = (await import(
    /* @vite-ignore */ pathToFileURL(join(resources, 'media', 'player.mjs')).href
  )) as typeof Libmpv
  const player = await runtime.createMpv({
    options: [
      ['config', false],
      ['pause', true],
      ['vo', 'null'],
      ['ao', 'null'],
      ['idle', true],
      ['keep-open', true],
    ],
    signal,
  })
  try {
    const loaded = Promise.withResolvers<void>()
    void loaded.promise.catch(() => {})
    const stop = () => loaded.reject(signal.reason)
    signal.addEventListener('abort', stop, { once: true })
    try {
      const events = await player.observeEvents(
        {
          next(event) {
            if (event.type === 'file-loaded') {
              loaded.resolve()
            }
            if (event.type === 'end-file' && event.reason === 'error') {
              loaded.reject(
                new DesktopError(
                  'ReadFailed',
                  `libmpv could not open this file (${event.errorCode})`,
                ),
              )
            }
          },
          error: loaded.reject,
          complete: () =>
            loaded.reject(
              new DesktopError('ReadFailed', 'Media inspection ended before the file loaded'),
            ),
        },
        { events: ['file-loaded', 'end-file'], signal },
      )
      try {
        signal.throwIfAborted()
        await player.command(['loadfile', path, 'replace'], { signal })
        await loaded.promise
        async function optional(name: 'duration' | 'width' | 'height') {
          try {
            return number(await player.getProperty(name, { signal }))
          } catch (cause) {
            if (cause instanceof runtime.MpvNativeError && cause.code === -10) {
              return null
            }
            throw cause
          }
        }
        const [container, durationSeconds, width, height, rawTracks, rawChapters] =
          await Promise.all([
            player.getProperty('file-format', { signal }),
            optional('duration'),
            optional('width'),
            optional('height'),
            player.getProperty('track-list', { signal }),
            player.getProperty('chapter-list', { signal }),
          ])
        const indices = { video: 0, audio: 0, sub: 0 }
        const tracks = maps(rawTracks).flatMap((row) => {
          const type = row.type
          if (type !== 'video' && type !== 'audio' && type !== 'sub') {
            return []
          }
          return [
            {
              type: type as 'video' | 'audio' | 'sub',
              index: indices[type]++,
              codec: text(row.codec),
              language: text(row.lang),
              title: text(row.title),
            },
          ]
        })
        if (!tracks.some((track) => track.type === 'video')) {
          throw new DesktopError('InvalidInput', 'The selected file has no video track')
        }
        const chapters = maps(rawChapters).flatMap((row) => {
          const time = number(row.time)
          return time === null ? [] : [{ time, title: text(row.title) }]
        })
        const after = await stat(path, { bigint: true })
        if (
          before.ino !== after.ino ||
          before.dev !== after.dev ||
          before.size !== after.size ||
          before.mtimeNs !== after.mtimeNs
        ) {
          throw new DesktopError('TargetChanged', 'The video changed during inspection')
        }
        return {
          metadata: { container: String(container), width, height, durationSeconds },
          tracks,
          chapters,
        }
      } finally {
        await events.dispose()
      }
    } finally {
      signal.removeEventListener('abort', stop)
    }
  } finally {
    await player.close()
  }
}
