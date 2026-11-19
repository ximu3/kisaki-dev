/** @fileoverview Prepares real font metadata, commits user font edits and hands out independent fixed file reads. */

import { releaseAll } from '../../infrastructure/release'
import { readFile } from 'node:fs/promises'
import type { Readable } from 'node:stream'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type * as Fontkit from 'fontkit'
import type { NativeCapabilities } from '#native'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseFontFileMetadata,
  parseFontImport,
  parseFontUpdate,
  type FontFile,
  type FontFileUpdateInput,
  type FontUpdate,
  type FontImportInput,
  type FontRead,
  type PreparedFontFile,
} from '@kisaki3/desktop-contracts/fonts'
import type { FileInput, ReadResource } from '@kisaki3/desktop-contracts/resources'
import {
  parseListOptions,
  type CallOptions,
  type ListOptions,
} from '@kisaki3/desktop-contracts/operations'
import { createSignal } from '../../infrastructure/events'
import type { createAttachments, PreparedContent } from '../../infrastructure/attachments'
import type { createResources } from '../../infrastructure/resources'
import type { DatabaseCall } from '../../infrastructure/database/executor'
import type { fontStorage } from './storage'

/** Upper bound on compressed font input retained by the parser. */
const maxFontBytes = 32 * 1024 * 1024

/** Decodes the supported containers and actual face metrics before publishing a preparation. */
function inspectFont(bytes: Buffer, create: typeof Fontkit.create) {
  const formats: Readonly<Record<string, string>> = {
    wOFF: 'font/woff',
    wOF2: 'font/woff2',
    OTTO: 'font/otf',
    '\x00\x01\x00\x00': 'font/ttf',
  }
  const mediaType = formats[bytes.toString('latin1', 0, 4)]
  if (!mediaType) {
    throw new DesktopError('InvalidInput', 'Choose a TTF, OTF, WOFF or WOFF2 font')
  }
  const font = create(bytes)
  if ('fonts' in font) {
    throw new DesktopError('InvalidInput', 'Choose an individual font file')
  }
  const os = font['OS/2']
  const axes = Object.entries(font.variationAxes ?? {}).map(([tag, range]) => ({
    tag,
    min: range!.min,
    default: range!.default,
    max: range!.max,
  }))
  /** Returns a variable-axis range or the actual static OS/2 metric. */
  const metric = (tag: string, standard: number) => {
    const axis = axes.find((value) => value.tag === tag)
    return axis
      ? { min: axis.min, default: axis.default, max: axis.max }
      : { min: standard, default: standard, max: standard }
  }
  const uprightStyle = os.fsSelection.italic ? 'italic' : 'normal'
  const metadata = parseFontFileMetadata({
    faces: [
      {
        index: 0,
        family: font.familyName,
        subfamily: font.subfamilyName,
        fullName: font.fullName ?? null,
        postScriptName: font.postscriptName ?? null,
        weight: metric('wght', os.usWeightClass),
        width: metric(
          'wdth',
          [50, 62.5, 75, 87.5, 100, 112.5, 125, 150, 200][os.usWidthClass - 1]!,
        ),
        style: os.fsSelection.oblique ? 'oblique' : uprightStyle,
        axes,
      },
    ],
  })
  return { metadata, mediaType }
}

/** Creates the font library; the preparation map ties metadata to bytes verified in this process. */
export function createFonts(
  runtime: string,
  attachments: ReturnType<typeof createAttachments>,
  resources: ReturnType<typeof createResources>,
  call: DatabaseCall<ReturnType<typeof fontStorage>>,
  listFontFamilies: NativeCapabilities['listFontFamilies'],
) {
  const decoder = createRequire(join(runtime, 'media', 'index.cjs'))
  /** Notifies consumers after a committed library change. */
  const invalidated = createSignal<void>()
  const prepared = new Map<string, { file: FontFile; content: PreparedContent }>()

  /** Acquires a verified temporary font for a caller's editing or save operation. */
  async function prepare(
    input: FileInput | Readable,
    options?: CallOptions,
  ): Promise<PreparedFontFile> {
    const stage = await attachments.stage(input, maxFontBytes, options?.signal)
    try {
      const bytes = await readFile(stage.path)
      let inspection: ReturnType<typeof inspectFont>
      try {
        inspection = inspectFont(bytes, (decoder('fontkit') as typeof Fontkit).create)
      } catch (cause) {
        if (cause instanceof DesktopError) {
          throw cause
        }
        throw new DesktopError('InvalidInput', 'The font file could not be decoded', { cause })
      }
      const { metadata, mediaType } = inspection
      options?.signal?.throwIfAborted()
      const content = await attachments.prepare(stage, mediaType)
      const file = { attachmentId: content.metadata.id, metadata }
      prepared.set(content.resource.id, { file, content })
      return {
        ...file,
        resource: content.resource,
        /** Releases the verified bytes and withdraws this preparation. */
        async dispose() {
          prepared.delete(content.resource.id)
          await content.dispose()
        },
      }
    } finally {
      await stage.dispose()
    }
  }

  /** Acquires save-owned holds before the caller can release its editing resources. */
  async function save(
    id: string | null,
    name: string | undefined,
    inputs: readonly FontFileUpdateInput[] | undefined,
    expected: FontUpdate['expected'],
    options?: CallOptions,
  ) {
    options?.signal?.throwIfAborted()
    const cleanups: Array<() => Promise<void>> = []
    const files: FontFile[] = []
    const additions: PreparedContent[] = []
    try {
      // Acquire every caller-owned input before the first asynchronous lookup or preparation.
      const admitted = (inputs ?? []).map((input) => {
        if ('attachmentId' in input && 'resource' in input) {
          const verified = prepared.get(input.resource.id)
          if (!verified || verified.file.attachmentId !== input.attachmentId) {
            throw new DesktopError('InvalidReference', 'This font preparation has ended')
          }
          const lease = resources.hold(input.resource)
          cleanups.push(() => lease.dispose())
          return { verified }
        }
        if ('type' in input && input.type === 'resource') {
          const lease = resources.hold(input.resource)
          cleanups.push(() => lease.dispose())
          return { source: { type: 'resource' as const, resource: lease.resource } }
        }
        return { source: input }
      })
      const retained =
        inputs?.some((input) => 'attachmentId' in input && !('resource' in input)) && id
          ? await call('getFont', id)
          : null
      for (const item of admitted) {
        if (item.verified) {
          files.push(item.verified.file)
          additions.push(item.verified.content)
          continue
        }
        const input = item.source!
        if ('attachmentId' in input && !('resource' in input)) {
          const file = retained?.files.find((old) => old.attachmentId === input.attachmentId)
          if (!file) {
            throw new DesktopError(
              'InvalidReference',
              'The retained file does not belong to this font',
            )
          }
          files.push(file)
        } else {
          const read = await prepare(input as FileInput, options)
          cleanups.push(() => read.dispose())
          const data = prepared.get(read.resource.id)
          if (!data || data.file.attachmentId !== read.attachmentId) {
            throw new DesktopError('InvalidReference', 'This font preparation has ended')
          }
          files.push(data.file)
          additions.push(data.content)
        }
      }
      options?.signal?.throwIfAborted()
      const result = await call(
        'saveFont',
        id,
        name,
        inputs && files,
        additions.map((item) => item.metadata),
        expected,
      )
      attachments.retire(result.released)
      invalidated.emit()
      return result.font
    } finally {
      await releaseAll(cleanups)
    }
  }

  return {
    prepare,
    /** Prepares a new user font for atomic adoption with the theme which references it. */
    async prepareCopy(inputs: readonly FileInput[], options?: CallOptions) {
      const holds: PreparedFontFile[] = []
      /** Releases every held file in an uncommitted font copy. */
      const dispose = async () => {
        await releaseAll(holds.map((file) => () => file.dispose()))
      }
      try {
        for (const input of inputs) {
          holds.push(await prepare(input, options))
        }
        const files = holds.map((read) => prepared.get(read.resource.id)!)
        const value = {
          id: randomUUID(),
          name: files[0]!.file.metadata.faces[0].family,
          files: files.map((file) => file.file),
          attachments: files.map((file) => file.content.metadata),
        }
        return { value, dispose }
      } catch (error) {
        await dispose()
        throw error
      }
    },
    /** Publishes the directory change after an owning transaction adopted copied font files. */
    adopted() {
      invalidated.emit()
    },
    /** Returns distinct installed family names as reported by the host's font system. */
    async listSystem(options?: CallOptions) {
      options?.signal?.throwIfAborted()
      const installed = await listFontFamilies(options?.signal)
      return [...new Set(installed)].sort((a, b) => a.localeCompare(b))
    },
    /** Reads one bounded interval of user font summaries. */
    async list(query: { search: string }, options: ListOptions, context?: CallOptions) {
      context?.signal?.throwIfAborted()
      return call('listFonts', query.search, parseListOptions(options))
    },
    /** Reads a complete saved font without acquiring its bytes. */
    async get(id: string, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      return call('getFont', id)
    },
    /** Parses and commits all files as one new font. */
    import(input: FontImportInput, options?: CallOptions) {
      const value = parseFontImport(input)
      return save(null, value.name, value.files, undefined, options)
    },
    /** Commits only the submitted name or final file-set changes. */
    update(id: string, input: FontUpdate, options?: CallOptions) {
      const { changes, expected } = parseFontUpdate(input)
      return save(id, changes.name, changes.files, expected, options)
    },
    /** Removes the user font and invalidates the library. */
    async delete(id: string, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      attachments.retire(await call('deleteFont', id))
      invalidated.emit()
    },
    /** Acquires a fixed definition and independent holds on all its files. */
    async open(id: string, options?: CallOptions): Promise<FontRead> {
      options?.signal?.throwIfAborted()
      const font = await call('getFont', id)
      if (!font) {
        throw new DesktopError('NotFound', 'The font does not exist')
      }
      const reads: Record<string, ReadResource> = {}
      /** Releases every file acquired for the font read. */
      const dispose = async () => {
        await releaseAll(Object.values(reads).map((read) => () => read.dispose()))
      }
      try {
        for (const file of font.files) {
          options?.signal?.throwIfAborted()
          reads[file.attachmentId] = await attachments.read(file.attachmentId, options)
        }
        options?.signal?.throwIfAborted()
        return {
          font,
          resources: Object.fromEntries(
            Object.entries(reads).map(([key, read]) => [key, read.resource]),
          ),
          dispose,
        }
      } catch (error) {
        await dispose()
        throw error
      }
    },
    onInvalidated: invalidated.on,
  }
}
