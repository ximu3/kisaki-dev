/** @fileoverview Defines native and search navigation targets, retaining exact entry selectors and stable field identities. */

import * as v from 'valibot'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { parseThemeRef } from '../appearance'
import type { ThemeRef } from '../appearance'
import { DesktopError } from '../errors'
import { parsePreferenceKey } from '../preferences'
import type { PreferenceKey } from '../preferences'
import {
  entryTypes,
  parseEntryRef,
  parseExternalIdentity,
  parsePartRef,
  parseWorkRef,
} from '../library/catalog'
import type {
  EntryRef,
  EntryType,
  ExternalIdentity,
  PartRef,
  PartType,
  PartWorkType,
  WorkRef,
} from '../library/catalog'
import { parseAnnotationRef } from '../library/annotations'
import { partWorkType } from '../library/parts'
import type { AnnotationRef } from '../library/annotations'
import {
  id,
  omitFields,
  optionalFields,
  parseExternalValue,
  parseValue,
  readRecord,
} from '../validation'
import { parsePageRef } from './pages'
import type { PageRef } from './pages'

/** External addresses resolve only an existing root Entry in the receiving library; parts always use explicit local IDs. */
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

/** Search navigation never starts content or writes preferences; each target is an existing native navigation capability. */
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
      'collection' | 'tag' | 'note']
  | { readonly type: 'annotation'; readonly ref: AnnotationRef }
  | { [K in 'metadataProfile' | 'scanConfig']: { readonly type: K; readonly id: string } }[
      'metadataProfile' | 'scanConfig']
  | { readonly type: 'launchConfig'; readonly gameId: string; readonly id: string }
  | { readonly type: 'theme'; readonly ref: ThemeRef }
  | { readonly type: 'font'; readonly id: string }
  | { readonly type: 'extension'; readonly id: string }
  | { readonly type: 'page'; readonly ref: PageRef }
  | { readonly type: 'preference'; readonly key: PreferenceKey }
/** Internal management targets do not automatically receive a public URL or cross-restart notification restoration. */
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
/** Validate explicit root identity without inferring local/external status from the string's appearance. */
export function parseEntryIdentifier(input: unknown): EntryIdentifier {
  const value = parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('local'), id }),
      v.strictObject({ type: v.literal('external'), source: id, sourceId: id }),
    ]),
    input,
    'Invalid entry identifier',
  )
  if (value.type === 'external') {
    return {
      type: 'external',
      ...parseExternalIdentity({ source: value.source, sourceId: value.sourceId }),
    }
  }
  return value
}
/** Shared entry-selector rules for internal navigation and public URLs. Real membership is checked by the receiving owner. */
export function parseEntryViewSelection<T extends EntryType>(
  type: T,
  input: unknown,
): EntryViewSelection<T> {
  const fields: v.ObjectEntries = entrySelectionEntries[type]
  const value = parseValue(v.strictObject(fields), input, 'Invalid entry selection')
  if (type === 'anime' && 'episodeId' in value && 'extraId' in value) {
    throw new DesktopError('InvalidInput', 'Episode and extra selectors are mutually exclusive')
  }
  return value as EntryViewSelection<T>
}
/** Validate native targets without creating a window, resolving IDs or changing visibility. */
export function parseNativeViewTarget(input: unknown): NativeViewTarget {
  const record = readRecord(input)
  if (record.type === 'entry') {
    const entryType = parseValue(v.picklist(entryTypes), record.entryType)
    const value = parseValue(
      v.strictObject({
        type: v.literal('entry'),
        entryType: v.literal(entryType),
        identifier: v.pipe(v.unknown(), v.transform(parseEntryIdentifier)),
        ...entrySelectionEntries[entryType],
      }),
      input,
      'Invalid entry view target',
    )
    const selection = omitFields(value, ['type', 'entryType', 'identifier'])
    parseEntryViewSelection(entryType, selection)
    return value as EntryViewTarget
  }
  const value = parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('library') }),
      v.strictObject({ type: v.literal('entries'), entryType: v.picklist(entryTypes) }),
      v.strictObject({ type: v.picklist(['collection', 'tag', 'note']), id: v.exactOptional(id) }),
      v.strictObject({
        type: v.literal('annotation'),
        ref: v.pipe(v.unknown(), v.transform(parseAnnotationRef)),
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
        key: v.exactOptional(v.pipe(v.unknown(), v.transform(parsePreferenceKey))),
      }),
      v.strictObject({
        type: v.literal('extensions'),
        extensionId: v.exactOptional(
          v.pipe(
            v.unknown(),
            v.transform((value) =>
              parseExternalValue(parseId, value, 'Invalid extension identity'),
            ),
          ),
        ),
        pageId: v.exactOptional(id),
      }),
      v.strictObject({
        type: v.literal('themes'),
        ref: v.exactOptional(v.pipe(v.unknown(), v.transform(parseThemeRef))),
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
/** Validate the closed target family and the medium implied by a formal part. Actual ownership still requires the library. */
export function parseSearchTarget(input: unknown): SearchTarget {
  const value = parseValue(
    v.variant('type', [
      v.strictObject({
        type: v.literal('entry'),
        ref: v.pipe(v.unknown(), v.transform(parseEntryRef)),
      }),
      v.strictObject({
        type: v.literal('part'),
        ref: v.pipe(v.unknown(), v.transform(parsePartRef)),
        work: v.pipe(v.unknown(), v.transform(parseWorkRef)),
      }),
      v.strictObject({
        type: v.picklist(['collection', 'tag', 'note', 'metadataProfile', 'scanConfig', 'font']),
        id,
      }),
      v.strictObject({
        type: v.literal('extension'),
        id: v.pipe(
          v.unknown(),
          v.transform((value) => parseExternalValue(parseId, value, 'Invalid extension identity')),
        ),
      }),
      v.strictObject({
        type: v.literal('annotation'),
        ref: v.pipe(v.unknown(), v.transform(parseAnnotationRef)),
      }),
      v.strictObject({ type: v.literal('launchConfig'), gameId: id, id }),
      v.strictObject({
        type: v.literal('theme'),
        ref: v.pipe(v.unknown(), v.transform(parseThemeRef)),
      }),
      v.strictObject({
        type: v.literal('page'),
        ref: v.pipe(v.unknown(), v.transform(parsePageRef)),
      }),
      v.strictObject({
        type: v.literal('preference'),
        key: v.pipe(v.unknown(), v.transform(parsePreferenceKey)),
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
