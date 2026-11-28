import * as v from 'valibot'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseFileRecognitionDefinitionShape,
  parseReorderInput,
  type FileRecognitionProfileFields,
  type FileWorkType,
} from '@kisaki3/desktop-contracts/library'
import type { Translate } from '@kisaki3/desktop-localization'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import { openEvaluator } from './evaluator'
import type { recognitionStorage } from './storage'
import catalog from './presets.json'

export function fileMedium(raw: unknown): FileWorkType {
  if (raw !== 'anime' && raw !== 'comic' && raw !== 'novel') {
    throw new DesktopError('InvalidInput', 'Choose anime, comic or novel')
  }
  return raw
}

const codes = {
  'anime-episode-number': 'animeEpisode',
  'anime-title-episode-number': 'animeTitle',
  'anime-dual-main-number': 'animeMain',
  'anime-dual-alternate-number': 'animeAlternate',
  'book-volume-number': 'bookVolume',
  'book-title-volume-number': 'bookTitle',
  'comic-work-chapter-number': 'comicChapter',
  'comic-title-work-chapter-number': 'comicTitle',
  'comic-volume-local-chapter-number': 'comicVolumeChapter',
  'comic-volume-work-chapter-number': 'comicVolumeTitle',
} as const
const string = v.pipe(v.string(), v.nonEmpty())
const fields = v.strictObject({
  name: string,
  description: v.nullable(v.string()),
  definition: v.unknown(),
})
const partial = v.strictObject({
  name: v.exactOptional(string),
  description: v.exactOptional(v.nullable(v.string())),
  definition: v.exactOptional(v.unknown()),
})
export function createProfiles(
  call: DatabaseCall<ReturnType<typeof recognitionStorage>>,
  worker: URL,
  t: () => Translate,
  changed: (type: FileWorkType, profile: string | null, definition: boolean) => void,
) {
  async function definition(type: FileWorkType, raw: unknown, signal: AbortSignal) {
    const input = parseFileRecognitionDefinitionShape(type, raw)
    const execution = await openEvaluator(worker, type, input, signal)
    await execution.close()
    return input
  }
  function presets(type: FileWorkType) {
    const translate = t()
    return catalog.flatMap((item) => {
      if (!item.workTypes.includes(type)) {
        return []
      }
      const key = codes[item.id as keyof typeof codes]
      const name = translate(`library.filePresets.${key}.name`)
      return [
        {
          id: item.id,
          name,
          description: translate(`library.filePresets.${key}.description`),
          definition: parseFileRecognitionDefinitionShape(type, {
            rules: [{ ...item.rule, id: item.id, name }],
          }),
        },
      ]
    })
  }
  return {
    list: (type: FileWorkType) => call('listRecognitionProfiles', type),
    get: (type: FileWorkType, id: string) => call('readRecognitionProfile', type, id),
    references: (type: FileWorkType, id: string) => call('recognitionReferences', type, id),
    presets,
    async create(type: FileWorkType, raw: unknown, signal: AbortSignal) {
      const result = v.safeParse(fields, raw)
      if (!result.success) {
        throw new DesktopError('InvalidInput', 'Invalid recognition profile')
      }
      const input = {
        ...result.output,
        definition: await definition(type, result.output.definition, signal),
      }
      signal.throwIfAborted()
      const profile = await call('addRecognitionProfile', type, input)
      changed(type, profile.id, false)
      return profile
    },
    async update(type: FileWorkType, id: string, raw: unknown, signal: AbortSignal) {
      const result = v.safeParse(
        v.strictObject({ changes: partial, expected: v.exactOptional(partial) }),
        raw,
      )
      if (!result.success) {
        throw new DesktopError('InvalidInput', 'Invalid recognition profile update')
      }
      const { changes, expected } = result.output
      if (Object.keys(expected ?? {}).some((k) => !Object.hasOwn(changes, k))) {
        throw new DesktopError('InvalidInput', 'A baseline must refer to an edited field')
      }
      async function parse(
        input: typeof changes,
      ): Promise<Partial<FileRecognitionProfileFields<FileWorkType>>> {
        const { definition: rules, ...rest } = input
        return 'definition' in input
          ? { ...rest, definition: await definition(type, rules, signal) }
          : rest
      }
      const next = await parse(changes),
        previous = expected ? await parse(expected) : undefined
      signal.throwIfAborted()
      const saved = await call('editRecognitionProfile', type, id, next, previous)
      if (saved.changed) {
        changed(type, id, saved.definitionChanged)
      }
      return saved.profile
    },
    async delete(type: FileWorkType, id: string, signal: AbortSignal) {
      signal.throwIfAborted()
      await call('removeRecognitionProfile', type, id)
      changed(type, id, false)
    },
    async reorder(type: FileWorkType, raw: unknown, signal: AbortSignal) {
      signal.throwIfAborted()
      if (await call('orderRecognitionProfiles', type, parseReorderInput(raw))) {
        changed(type, null, false)
      }
    },
  }
}
