/** @fileoverview Declares complete local-content operations and validates their explicit identities and modification units. */

import * as v from 'valibot'
import { DesktopError, parseErrorSummary } from '../errors'
import type {
  CallOptions,
  ListOptions,
  ListResult,
  NonEmptyArray,
  StoredDefinition,
} from '../operations'
import { parseAbsolutePath, parsePathFilter } from '../paths'
import type { UsageOverride } from '../preferences/usage'
import {
  id,
  nonnegativeInteger,
  optionalFields,
  parseValue,
  positiveInteger,
  text,
  unique,
  validateExpectedKeys,
} from '../validation'
import { identityKey, identitySchema, workRefSchema } from './catalog'
import type { EntryRef, PartRef, WorkRef, WorkType } from './catalog'
import type {
  FileRecognitionDefinition,
  FileRecognitionProfilesApi,
  FileWorkType,
} from './file-recognition'
import type { GameLaunchConfigsApi } from './game-configuration'
import type { GameBackupsApi } from './backups'
import type {
  ContentDirectory,
  DirectoryCreateFields,
  DirectoryDiscoveryDefinition,
  DirectoryRelocationInput,
  DirectoryUpdate,
  FileAssociationChange,
  FileAssociationEdit,
  FileAssociationInput,
  FileAssociationMode,
  FileCreateFields,
  FileMergeInput,
  FileMergeResult,
  FilePartType,
  FilePlaybackChoices,
  FilePreferenceChangeByType,
  FilePreferencesByType,
  FileQuery,
  FileRecognitionResult,
  FileReidentificationResult,
  FileTrackSelection,
  HeldFile,
  HoldingsRefreshResult,
  HoldingsRelocationResult,
  LocalContentInput,
  LocalContentRegistrationOptions,
  LocalContentRegistrationResult,
  PreferredFileInput,
  PreferredPartFile,
} from './holdings-values'

/** Directory registration owns discovery only; deletion retains files/configurations, and relocation never moves user bytes. */
export interface ContentDirectoriesApi {
  list<T extends WorkType>(
    work: EntryRef<T>,
    call?: CallOptions,
  ): Promise<readonly ContentDirectory<T>[]>
  get<T extends WorkType>(
    work: EntryRef<T>,
    directoryId: string,
    call?: CallOptions,
  ): Promise<ContentDirectory<T> | null>

  create(
    ...args: {
      [K in WorkType]: [work: EntryRef<K>, input: DirectoryCreateFields<K>, call?: CallOptions]
    }[WorkType]
  ): Promise<string>
  update(
    work: EntryRef<FileWorkType>,
    directoryId: string,
    input: DirectoryUpdate,
    call?: CallOptions,
  ): Promise<void>
  delete(work: WorkRef, directoryId: string, call?: CallOptions): Promise<void>
  relocate(
    work: WorkRef,
    directoryId: string,
    input: DirectoryRelocationInput,
    call?: CallOptions,
  ): Promise<HoldingsRelocationResult>
}

export type UsagePreferenceTarget =
  { readonly type: 'work' } | { readonly type: 'file'; readonly fileId: string }

/** Complete custom settings stay independent of parent changes and do not reconfigure already-open content by themselves. */
export interface HoldingsPreferencesApi {
  get<T extends FileWorkType>(
    work: EntryRef<T>,
    target: UsagePreferenceTarget,
    call?: CallOptions,
  ): Promise<StoredDefinition<UsageOverride<FilePreferencesByType[T]>> | null>
  update(
    ...args: {
      [K in FileWorkType]: [
        work: EntryRef<K>,
        target: UsagePreferenceTarget,
        input: FilePreferenceChangeByType[K],
        call?: CallOptions,
      ]
    }[FileWorkType]
  ): Promise<UsageOverride<FilePreferencesByType[FileWorkType]>>

  getEffective<T extends FileWorkType>(
    work: EntryRef<T>,
    fileId: string,
    call?: CallOptions,
  ): Promise<{
    readonly source: 'global' | 'work' | 'file'
    readonly settings: FilePreferencesByType[T]
  }>
}

/** File-specific saved choices are independent of whole playback overrides and runtime track IDs. */
export interface FilePlaybackChoicesApi {
  get(
    animeId: string,
    fileId: string,
    call?: CallOptions,
  ): Promise<StoredDefinition<FilePlaybackChoices>>
  update(
    animeId: string,
    fileId: string,
    input: {
      readonly changes: Partial<FilePlaybackChoices>
      readonly expected?: Partial<FilePlaybackChoices>
    },
    call?: CallOptions,
  ): Promise<void>
}

/** Actual files belong directly to a work. Explicit association/path changes must respect active-file occupancy. */
export interface HeldFilesApi {
  list<T extends FileWorkType>(
    work: EntryRef<T>,
    query: FileQuery<T>,
    options: ListOptions,
    call?: CallOptions,
  ): Promise<ListResult<HeldFile<T>>>
  get<T extends FileWorkType>(
    work: EntryRef<T>,
    fileId: string,
    call?: CallOptions,
  ): Promise<HeldFile<T> | null>

  /** Return the actual new or reused same-position identity, preserving existing state unless explicit association intent was supplied. */
  add(
    ...args: {
      [K in FileWorkType]: [work: EntryRef<K>, input: FileCreateFields<K>, call?: CallOptions]
    }[FileWorkType]
  ): Promise<string>
  update(
    work: EntryRef<FileWorkType>,
    fileId: string,
    input: {
      readonly changes: { readonly note?: string | null }
      readonly expected?: { readonly note?: string | null }
    },
    call?: CallOptions,
  ): Promise<void>
  delete(
    work: EntryRef<FileWorkType>,
    fileIds: NonEmptyArray<string>,
    call?: CallOptions,
  ): Promise<void>

  editAssociations(
    ...args: {
      [K in FileWorkType]: [
        work: EntryRef<K>,
        fileId: string,
        input: FileAssociationEdit<K>,
        call?: CallOptions,
      ]
    }[FileWorkType]
  ): Promise<void>

  /** Saving a manual association edit also sets manual. Mode-only changes preserve associations and allow current use. */
  setAssociationMode(
    work: EntryRef<FileWorkType>,
    fileId: string,
    input: {
      readonly mode: FileAssociationMode
      readonly expected?: { readonly associationMode: FileAssociationMode }
    },
    call?: CallOptions,
  ): Promise<void>

  setPreferred(
    ...args: {
      [K in FileWorkType]: [work: EntryRef<K>, input: PreferredFileInput<K>, call?: CallOptions]
    }[FileWorkType]
  ): Promise<void>
  setPreferredMany(
    ...args: {
      [K in FileWorkType]: [
        work: EntryRef<K>,
        items: NonEmptyArray<PreferredPartFile<K>>,
        call?: CallOptions,
      ]
    }[FileWorkType]
  ): Promise<void>
  relocate(
    work: EntryRef<FileWorkType>,
    fileId: string,
    input: { readonly path: string; readonly expected?: { readonly path: string } },
    call?: CallOptions,
  ): Promise<HoldingsRelocationResult>
  merge(
    work: EntryRef<FileWorkType>,
    input: FileMergeInput,
    call?: CallOptions,
  ): Promise<FileMergeResult>

  /** Compute all selected files first; the valid association changes commit in one short transaction and retain each mode. */
  reidentify<T extends FileWorkType>(
    work: EntryRef<T>,
    fileIds: NonEmptyArray<string>,
    call?: CallOptions,
  ): Promise<FileReidentificationResult<T>>

  /** Test a draft against an actual file without changing its associations, mode, preference or position. */
  testRecognition<T extends FileWorkType>(
    work: EntryRef<T>,
    fileId: string,
    input?: { readonly definition?: FileRecognitionDefinition<T> },
    call?: CallOptions,
  ): Promise<FileRecognitionResult<T>>

  readonly playbackChoices: FilePlaybackChoicesApi
}

/** Four-work registration, media maintenance and game backup are separate capabilities, sharing stable local identities. */
export interface HoldingsApi {
  readonly directories: ContentDirectoriesApi
  readonly files: HeldFilesApi
  readonly launchConfigs: GameLaunchConfigsApi
  readonly backups: GameBackupsApi
  readonly preferences: HoldingsPreferencesApi
  readonly recognitionProfiles: {
    readonly anime: FileRecognitionProfilesApi<'anime'>
    readonly comic: FileRecognitionProfilesApi<'comic'>
    readonly novel: FileRecognitionProfilesApi<'novel'>
  }

  registerLocalContent(
    work: WorkRef,
    input: LocalContentInput,
    options?: LocalContentRegistrationOptions,
    call?: CallOptions,
  ): Promise<LocalContentRegistrationResult>
  refresh<T extends FileWorkType>(
    work: EntryRef<T>,
    call?: CallOptions,
  ): Promise<HoldingsRefreshResult<T>>
}

const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))
const mode = v.picklist(['automatic', 'manual'])

const discoverySchema = v.strictObject({
  maxDepth: v.nullable(positiveInteger),
  include: v.array(v.pipe(v.unknown(), v.transform(parsePathFilter))),
  exclude: v.array(v.pipe(v.unknown(), v.transform(parsePathFilter))),
})

export const filePartTypes: { readonly [K in FileWorkType]: readonly FilePartType<K>[] } = {
  anime: ['animeEpisode', 'animeExtra'],
  comic: ['comicVolume', 'comicChapter'],
  novel: ['novelVolume'],
}

function partSchema<T extends FileWorkType>(
  type: T,
): v.GenericSchema<unknown, PartRef<FilePartType<T>>> {
  const types: readonly FilePartType<T>[] = filePartTypes[type]
  return v.strictObject({ type: v.picklist(types), id })
}

function partKey(part: PartRef): string {
  return JSON.stringify([part.type, part.id])
}

function associationSchema<T extends FileWorkType>(type: T) {
  return v.strictObject({ part: partSchema(type), isPreferred: v.exactOptional(v.boolean()) })
}

/** Return the complete initial discovery value; callers do not silently substitute this for a broken saved definition. */
export function getDirectoryDiscoveryDefaults(): DirectoryDiscoveryDefinition {
  return { maxDepth: null, include: [], exclude: [] }
}

/** Validate discovery only; it does not choose an identification profile or change existing file maintenance. */
export function parseDirectoryDiscoveryDefinition(input: unknown): DirectoryDiscoveryDefinition {
  return parseValue(discoverySchema, input, 'Invalid directory discovery definition')
}

/** Game directories reject media-discovery and naming-profile fields instead of preserving inapplicable data. */
export function parseDirectoryCreateFields<T extends WorkType>(
  workType: T,
  input: unknown,
): DirectoryCreateFields<T> {
  const schema =
    workType === 'game'
      ? v.strictObject({ path })
      : v.strictObject({
          path,
          definition: v.exactOptional(discoverySchema),
          recognitionProfileId: v.exactOptional(v.nullable(id)),
        })
  return parseValue(schema, input, 'Invalid directory creation') as DirectoryCreateFields<T>
}

/** Discovery and naming-profile changes compare only their corresponding complete original values. */
export function parseDirectoryUpdate(input: unknown): DirectoryUpdate {
  const fields = v.strictObject(
    optionalFields({ definition: discoverySchema, recognitionProfileId: v.nullable(id) }),
  )
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
    'Invalid directory edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

/** Validate new-file intent, including compatible real part kinds and unique explicit associations. */
export function parseFileCreateFields<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileCreateFields<T> {
  return parseValue(
    v.strictObject({
      path,
      note: v.exactOptional(v.nullable(text)),
      associations: v.exactOptional(
        v.pipe(
          v.array(associationSchema(workType)),
          v.check((items) => unique(items, (item) => partKey(item.part))),
        ),
      ),
      isPreferred: v.exactOptional(v.boolean()),
    }),
    input,
    'Invalid file registration',
  ) as FileCreateFields<T>
}

/** Explicit empty association input is a manual decision, not a failed automatic match. */
export function initialFileAssociationMode(
  associations: readonly FileAssociationInput[] | undefined,
): FileAssociationMode {
  return associations === undefined ? 'automatic' : 'manual'
}

/** Parse the complete direct set or disjoint incremental intent; partial comic volume/chapter views cannot replace it. */
export function parseFileAssociationChange<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileAssociationChange<T> {
  const part = partSchema(workType)
  const members = v.pipe(
    v.array(associationSchema(workType)),
    v.check((items) => unique(items, (item) => partKey(item.part))),
  )
  return parseValue(
    v.union([
      v.strictObject({ type: v.literal('replace'), items: members }),
      v.pipe(
        v.strictObject({
          type: v.literal('modify'),
          add: v.exactOptional(members),
          remove: v.exactOptional(
            v.pipe(
              v.array(part),
              v.check((items) => unique(items, partKey)),
            ),
          ),
        }),
        v.check(
          (value) =>
            (value.add?.length ?? 0) + (value.remove?.length ?? 0) > 0 &&
            !(value.add ?? []).some((item) =>
              value.remove?.some((ref) => partKey(ref) === partKey(item.part)),
            ),
        ),
      ),
    ]),
    input,
    'Invalid file associations',
  ) as FileAssociationChange<T>
}

/** A supplied edit baseline contains both the complete direct associations and the original matching permission. */
export function parseFileAssociationEdit<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileAssociationEdit<T> {
  const member = v.strictObject({ part: partSchema(workType), isPreferred: v.boolean() })
  return parseValue(
    v.strictObject({
      change: v.pipe(
        v.unknown(),
        v.transform((value) => parseFileAssociationChange(workType, value)),
      ),
      expected: v.exactOptional(
        v.strictObject({
          associations: v.pipe(
            v.array(member),
            v.check((items) => unique(items, (item) => partKey(item.part))),
          ),
          associationMode: mode,
        }),
      ),
    }),
    input,
    'Invalid association adoption',
  ) as FileAssociationEdit<T>
}

/** Mode-only intent never changes the complete association set. */
export function parseFileAssociationModeChange(input: unknown): {
  readonly mode: FileAssociationMode
  readonly expected?: { readonly associationMode: FileAssociationMode }
} {
  return parseValue(
    v.strictObject({ mode, expected: v.exactOptional(v.strictObject({ associationMode: mode })) }),
    input,
    'Invalid file association mode change',
  )
}

/** Validate query facts without probing files; a part filter is an exact direct association scope. */
export function parseFileQuery<T extends FileWorkType>(workType: T, input: unknown): FileQuery<T> {
  return parseValue(
    v.strictObject({
      search: text,
      directoryId: v.exactOptional(id),
      part: v.exactOptional(partSchema(workType)),
      association: v.exactOptional(v.picklist(['associated', 'unassociated'])),
      associationMode: v.exactOptional(mode),
      availability: v.exactOptional(v.picklist(['unchecked', 'accessible', 'unavailable'])),
    }),
    input,
    'Invalid file query',
  ) as FileQuery<T>
}

/** Validate a current input for one already known work; expected identities, when present, must be complete and nonempty. */
export function parseLocalContentInput(input: unknown): LocalContentInput {
  return parseValue(
    v.strictObject({ type: v.picklist(['directory', 'file']), path }),
    input,
    'Invalid local content input',
  )
}

export function parseLocalContentRegistrationOptions(
  input: unknown,
): LocalContentRegistrationOptions {
  return parseValue(
    v.strictObject({
      expectedIdentities: v.exactOptional(
        v.pipe(
          v.tupleWithRest([identitySchema], identitySchema),
          v.check((items) => unique(items, identityKey)),
        ),
      ),
    }),
    input,
    'Invalid local content identity precondition',
  )
}

/** Preserve actual registered/reused identities and post-commit issues without pretending the content is already usable. */
export function parseLocalContentRegistrationResult(
  input: unknown,
): LocalContentRegistrationResult {
  const registration = v.strictObject({
    type: v.picklist(['directory', 'file', 'launchConfig']),
    id,
    outcome: v.picklist(['registered', 'alreadyRegistered']),
  })
  const value = parseValue(
    v.strictObject({
      work: workRefSchema,
      registrations: v.tupleWithRest([registration], registration),
      issues: v.array(
        v.variant('code', [
          v.strictObject({
            code: v.literal('initialRefreshFailed'),
            error: v.pipe(v.unknown(), v.transform(parseErrorSummary)),
          }),
          v.strictObject({ code: v.literal('launchConfigIncomplete'), launchConfigId: id }),
        ]),
      ),
    }),
    input,
    'Invalid local content registration result',
  )
  if (
    value.registrations.some((item) =>
      value.work.type === 'game' ? item.type === 'file' : item.type === 'launchConfig',
    ) ||
    (value.work.type !== 'game' &&
      value.issues.some((issue) => issue.code === 'launchConfigIncomplete'))
  ) {
    throw new DesktopError('InvalidInput', 'Local registration result does not match its work type')
  }

  return value
}

/** Reject merging a file identity into itself. The host additionally checks both owners and the chosen current path. */
export function parseFileMergeInput(input: unknown): FileMergeInput {
  return parseValue(
    v.pipe(
      v.strictObject({ sourceFileId: id, targetFileId: id, path }),
      v.check((value) => value.sourceFileId !== value.targetFileId),
    ),
    input,
    'Invalid file merge',
  )
}

const track = v.variant('type', [
  v.strictObject({ type: v.literal('embedded'), index: nonnegativeInteger }),
  v.strictObject({ type: v.literal('external'), path, index: nonnegativeInteger }),
])

/** A source-local same-kind track ordinal is not a session's opaque runtime track ID. */
export function parseFileTrackSelection(input: unknown): FileTrackSelection {
  return parseValue(track, input, 'Invalid saved track selection')
}

/** Saved audio/subtitle choices replace complete references and signed finite-second offsets. */
export function parseFilePlaybackChoicesUpdate(input: unknown): {
  readonly changes: Partial<FilePlaybackChoices>
  readonly expected?: Partial<FilePlaybackChoices>
} {
  const fields = v.strictObject(
    optionalFields({
      audioTrack: v.nullable(track),
      subtitleTrack: v.nullable(track),
      audioDelaySeconds: v.pipe(v.number(), v.finite()),
      subtitleDelaySeconds: v.pipe(v.number(), v.finite()),
    }),
  )
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
    'Invalid saved playback choices',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

/** Validate an explicit preferred-file scope. Availability and a direct same-work association are checked at commit. */
export function parsePreferredFileInput<T extends FileWorkType>(
  workType: T,
  input: unknown,
): PreferredFileInput<T> {
  return parseValue(
    v.strictObject({
      scope: v.union([
        v.strictObject({ type: v.literal('work') }),
        v.strictObject({ type: v.literal('part'), part: partSchema(workType) }),
      ]),
      fileId: v.nullable(id),
      expected: v.exactOptional(v.strictObject({ preferredFileId: v.nullable(id) })),
    }),
    input,
    'Invalid preferred file',
  ) as PreferredFileInput<T>
}

/** Each part appears once; a chosen file may legitimately be preferred for more than one directly associated part. */
export function parsePreferredPartFiles<T extends FileWorkType>(
  workType: T,
  input: unknown,
): NonEmptyArray<PreferredPartFile<T>> {
  const item = v.strictObject({
    part: partSchema(workType),
    fileId: v.nullable(id),
    expected: v.exactOptional(v.strictObject({ preferredFileId: v.nullable(id) })),
  })
  return parseValue(
    v.pipe(
      v.tupleWithRest([item], item),
      v.check((items) => unique(items, (item) => partKey(item.part))),
    ),
    input,
    'Invalid preferred part files',
  ) as NonEmptyArray<PreferredPartFile<T>>
}

/** Validate explicit path mapping scope without changing paths, checking disk state or applying prefix replacements to text. */
export function parseDirectoryRelocationInput(
  workType: WorkType,
  input: unknown,
): DirectoryRelocationInput {
  const configField = v.picklist(['launchPath', 'workingDirectory', 'monitorPath', 'savePath'])
  const value = parseValue(
    v.strictObject({
      path,
      expected: v.exactOptional(v.strictObject({ path })),
      gameConfigFields: v.exactOptional(
        v.array(
          v.strictObject({
            launchConfigId: id,
            fields: v.pipe(
              v.tupleWithRest([configField], configField),
              v.check((items) => new Set(items).size === items.length),
            ),
          }),
        ),
      ),
      subtitlePaths: v.exactOptional(
        v.array(
          v.strictObject({
            fileId: id,
            paths: v.pipe(
              v.tupleWithRest([path], path),
              v.check((items) => unique(items, (item) => item)),
            ),
          }),
        ),
      ),
    }),
    input,
    'Invalid directory relocation',
  )
  if (
    (workType !== 'game' && value.gameConfigFields !== undefined) ||
    (workType !== 'anime' && value.subtitlePaths !== undefined)
  ) {
    throw new DesktopError('InvalidInput', 'Relocation fields are not applicable to this work type')
  }

  return value
}
