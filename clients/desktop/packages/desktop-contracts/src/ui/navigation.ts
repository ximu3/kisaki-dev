import {
  fromParser,
  optionalFields,
  id,
  parseValue,
  parseRecord,
  parseExternalValue,
} from '../validation'
import * as v from 'valibot'
import {
  identitySchema,
  entryTypes,
  parseEntryRef,
  parsePartRef,
  parseWorkRef,
  type ExternalIdentity,
  type EntryType,
  type EntryRef,
  type PartType,
  type WorkRef,
  type PartWorkType,
  type PartRef,
} from '../library/catalog'
import { DesktopError } from '../errors'
import { parseAnnotationRef, type AnnotationRef } from '../library/annotations'
import { parsePreferenceKey, type PreferenceKey } from '../preferences/api'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { parseThemeRef, type ThemeRef } from '../appearance'
import { parsePageRef, type PageRef } from './pages'
import { partWorkType } from '../library/parts'

export type EntryIdentifier =
  | { readonly type: 'local'; readonly id: string }
  | ({ readonly type: 'external' } & ExternalIdentity)

export interface EntryViewSelectionByType {
  readonly game: { readonly launchConfigId?: string }

  readonly anime: { readonly fileId?: string } & (
    | { readonly episodeId?: string; readonly extraId?: never }
    | { readonly episodeId?: never; readonly extraId: string }
  )

  readonly comic: {
    readonly volumeId?: string
    readonly chapterId?: string
    readonly fileId?: string
  }

  readonly novel: { readonly volumeId?: string; readonly fileId?: string }

  readonly character: object
  readonly person: object
  readonly organization: object
}

export type EntryViewSelection<T extends EntryType> = EntryViewSelectionByType[T]

export type EntryViewTarget = {
  [K in EntryType]: {
    readonly type: 'entry'
    readonly entryType: K
    readonly identifier: EntryIdentifier
  } & EntryViewSelection<K>
}[EntryType]

export type SearchTarget =
  | { readonly type: 'entry'; readonly ref: EntryRef }
  | {
      [K in PartType]: {
        readonly type: 'part'
        readonly work: WorkRef<PartWorkType<K>>
        readonly ref: PartRef<K>
      }
    }[PartType]
  | { [K in 'collection' | 'tag' | 'note']: { readonly type: K; readonly id: string } }[
      | 'collection'
      | 'tag'
      | 'note']
  | { readonly type: 'annotation'; readonly ref: AnnotationRef }
  | { [K in 'metadataProfile' | 'scanConfig']: { readonly type: K; readonly id: string } }[
      | 'metadataProfile'
      | 'scanConfig']
  | { readonly type: 'launchConfig'; readonly gameId: string; readonly id: string }
  | { readonly type: 'theme'; readonly ref: ThemeRef }
  | { readonly type: 'font'; readonly id: string }
  | { readonly type: 'extension'; readonly id: string }
  | { readonly type: 'page'; readonly ref: PageRef }
  | { readonly type: 'preference'; readonly key: PreferenceKey }

export type NativeViewTarget =
  | { readonly type: 'library' }
  | { readonly type: 'entries'; readonly entryType: EntryType }
  | EntryViewTarget
  | { readonly type: 'collection' | 'tag' | 'note'; readonly id?: string }
  | { readonly type: 'annotation'; readonly ref: AnnotationRef }
  | { readonly type: 'tasks'; readonly runId?: string }
  | { readonly type: 'scanner'; readonly configId?: string; readonly runId?: string }
  | { readonly type: 'metadataProfiles'; readonly profileId?: string }
  | { readonly type: 'sessions.recordings'; readonly sessionId?: string }
  | { readonly type: 'preferences'; readonly key?: PreferenceKey }
  | { readonly type: 'extensions'; readonly extensionId?: string; readonly pageId?: string }
  | { readonly type: 'themes'; readonly ref?: ThemeRef }
  | { readonly type: 'fonts'; readonly fontId?: string }
  | { readonly type: 'systemIntegration' | 'updates' | 'about' }
  | { readonly type: 'onboarding'; readonly mode?: 'firstUse' | 'update' | 'manual' }

export const entrySelectionEntries = {
  game: optionalFields({ launchConfigId: id }),
  anime: optionalFields({ episodeId: id, extraId: id, fileId: id }),
  comic: optionalFields({ volumeId: id, chapterId: id, fileId: id }),
  novel: optionalFields({ volumeId: id, fileId: id }),
  character: {},
  person: {},
  organization: {},
}

export function parseEntryIdentifier(input: unknown): EntryIdentifier {
  return parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('local'), id }),
      v.strictObject({ type: v.literal('external'), ...identitySchema.entries }),
    ]),
    input,
    'Invalid entry identifier',
  )
}

function checkPartSelection(selection: object): void {
  if (Object.hasOwn(selection, 'episodeId') && Object.hasOwn(selection, 'extraId')) {
    throw new DesktopError('InvalidInput', 'Episode and extra selectors are mutually exclusive')
  }
}

export function parseEntryViewSelection<T extends EntryType>(
  type: T,
  input: unknown,
): EntryViewSelection<T> {
  const fields: v.ObjectEntries = entrySelectionEntries[type]
  const value = parseValue(v.strictObject(fields), input, 'Invalid entry selection')
  checkPartSelection(value)

  return value as EntryViewSelection<T>
}

export function parseNativeViewTarget(input: unknown): NativeViewTarget {
  const record = parseRecord(input)
  if (record.type === 'entry') {
    const entryType = parseValue(v.picklist(entryTypes), record.entryType)
    const value = parseValue(
      v.strictObject({
        type: v.literal('entry'),
        entryType: v.literal(entryType),
        identifier: fromParser(parseEntryIdentifier),
        ...entrySelectionEntries[entryType],
      }),
      input,
      'Invalid entry view target',
    )
    checkPartSelection(value)
    return value as EntryViewTarget
  }

  const value = parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('library') }),
      v.strictObject({ type: v.literal('entries'), entryType: v.picklist(entryTypes) }),
      v.strictObject({ type: v.picklist(['collection', 'tag', 'note']), id: v.exactOptional(id) }),
      v.strictObject({
        type: v.literal('annotation'),
        ref: fromParser(parseAnnotationRef),
      }),
      v.strictObject({ type: v.literal('tasks'), runId: v.exactOptional(id) }),
      v.strictObject({
        type: v.literal('scanner'),
        configId: v.exactOptional(id),
        runId: v.exactOptional(id),
      }),
      v.strictObject({ type: v.literal('metadataProfiles'), profileId: v.exactOptional(id) }),
      v.strictObject({ type: v.literal('sessions.recordings'), sessionId: v.exactOptional(id) }),
      v.strictObject({
        type: v.literal('preferences'),
        key: v.exactOptional(fromParser(parsePreferenceKey)),
      }),
      v.strictObject({
        type: v.literal('extensions'),
        extensionId: v.exactOptional(
          fromParser((value) => parseExternalValue(parseId, value, 'Invalid extension identity')),
        ),
        pageId: v.exactOptional(id),
      }),
      v.strictObject({
        type: v.literal('themes'),
        ref: v.exactOptional(fromParser(parseThemeRef)),
      }),
      v.strictObject({ type: v.literal('fonts'), fontId: v.exactOptional(id) }),
      v.strictObject({ type: v.picklist(['systemIntegration', 'updates', 'about']) }),
      v.strictObject({
        type: v.literal('onboarding'),
        mode: v.exactOptional(v.picklist(['firstUse', 'update', 'manual'])),
      }),
    ]),
    input,
    'Invalid native navigation target',
  )
  if (
    value.type === 'extensions' &&
    value.pageId !== undefined &&
    value.extensionId === undefined
  ) {
    throw new DesktopError('InvalidInput', 'An extension page requires its owner')
  }

  return value
}

export function parseSearchTarget(input: unknown): SearchTarget {
  const value = parseValue(
    v.variant('type', [
      v.strictObject({
        type: v.literal('entry'),
        ref: fromParser(parseEntryRef),
      }),
      v.strictObject({
        type: v.literal('part'),
        ref: fromParser(parsePartRef),
        work: fromParser(parseWorkRef),
      }),
      v.strictObject({
        type: v.picklist(['collection', 'tag', 'note', 'metadataProfile', 'scanConfig', 'font']),
        id,
      }),
      v.strictObject({
        type: v.literal('extension'),
        id: fromParser((value) => parseExternalValue(parseId, value, 'Invalid extension identity')),
      }),
      v.strictObject({
        type: v.literal('annotation'),
        ref: fromParser(parseAnnotationRef),
      }),
      v.strictObject({ type: v.literal('launchConfig'), gameId: id, id }),
      v.strictObject({
        type: v.literal('theme'),
        ref: fromParser(parseThemeRef),
      }),
      v.strictObject({
        type: v.literal('page'),
        ref: fromParser(parsePageRef),
      }),
      v.strictObject({
        type: v.literal('preference'),
        key: fromParser(parsePreferenceKey),
      }),
    ]),
    input,
    'Invalid search navigation target',
  )
  if (value.type === 'part') {
    const owner = partWorkType(value.ref.type)
    if (value.work.type !== owner) {
      throw new DesktopError('InvalidInput', 'Part navigation uses the wrong work type')
    }
  }

  return value as SearchTarget
}
