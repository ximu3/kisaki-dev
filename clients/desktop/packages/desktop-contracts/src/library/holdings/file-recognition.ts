import type { FileWorkType, AnimeEpisodeType, AnimeExtraType, EntryRef, PartRef } from '../catalog'

import type { NonEmptyArray, StoredDefinition, CallOptions } from '../../operations'
import type { ReorderInput } from '../ordering'
import * as v from 'valibot'
import {
  fromParser,
  text,
  integer,
  parseValue,
  id,
  nonemptyText,
  unique,
  optionalFields,
  validateExpectedKeys,
} from '../../validation'
import { episodeTypeSchema, extraTypeSchema } from '../parts'
import { inspectTextPattern, parseTextTemplate } from '../../text-rules'
import type { FilePartType } from './associations'
import type { ErrorSummary } from '../../errors'

export interface FileConditionByType {
  readonly anime:
    | (NumberedPartCondition & {
        readonly kind: 'episode'
        readonly episodeType?: AnimeEpisodeType | null
      })
    | { readonly kind: 'extra'; readonly name: string; readonly extraType?: AnimeExtraType | null }

  readonly comic:
    | (NumberedPartCondition & { readonly kind: 'volume' })
    | (NumberedPartCondition & {
        readonly kind: 'chapter'
        readonly numberBasis?: 'work' | 'volume'
        readonly volume?: ComicVolumeScopeCondition
      })

  readonly novel: NumberedPartCondition & { readonly kind: 'volume' }
}

/** Subtracts the signed safe-integer offset from the integer portion after template expansion. */
export interface FileNumberValue {
  readonly value: string
  readonly offset: number
}

export type FileNumberOutput =
  | ({ readonly kind: 'single' } & FileNumberValue)
  | {
      readonly kind: 'range'
      readonly start: string
      readonly end: string
      readonly offset: number
    }

export type NumberedPartOutput =
  | { readonly number: FileNumberOutput; readonly name?: string }
  | { readonly number?: FileNumberOutput; readonly name: string }

/** Number or name templates that identify one volume for chapter interpretation. */
export type ComicVolumeScopeOutput =
  | { readonly number: FileNumberValue; readonly name?: string }
  | { readonly number?: FileNumberValue; readonly name: string }

export type AnimeFileTarget =
  | (NumberedPartOutput & {
      readonly kind: 'episode'
      readonly episodeType?: AnimeEpisodeType | null
    })
  | { readonly kind: 'extra'; readonly name: string; readonly extraType?: AnimeExtraType | null }

/**
 * Volume-relative chapter numbers require a volume scope. Work-wide numbers are evaluated within
 * the work.
 */
export type ComicFileTarget =
  | (NumberedPartOutput & { readonly kind: 'volume' })
  | ({ readonly kind: 'chapter'; readonly name?: string } & (
      | {
          readonly number: FileNumberOutput
          readonly numberBasis: 'work'
          readonly volume?: ComicVolumeScopeOutput
        }
      | {
          readonly number: FileNumberOutput
          readonly numberBasis: 'volume'
          readonly volume: ComicVolumeScopeOutput
        }
      | {
          readonly number?: never
          readonly numberBasis?: never
          readonly name: string
          readonly volume?: ComicVolumeScopeOutput
        }
    ))

export type NovelFileTarget = NumberedPartOutput & { readonly kind: 'volume' }

export interface FileTargetByType {
  readonly anime: AnimeFileTarget
  readonly comic: ComicFileTarget
  readonly novel: NovelFileTarget
}

/** Interpretation uses the first enabled full match. All targets must match together. */
export interface FileRecognitionRule<TTarget> {
  readonly id: string
  readonly name: string
  readonly enabled: boolean

  readonly input: 'baseName' | 'path'
  readonly pattern: string
  readonly ignoreCase: boolean

  readonly output: { readonly targets: NonEmptyArray<TTarget> }
}

/** The ordered filename rules for one medium; an empty rule list is valid. */
export interface FileRecognitionDefinition<T extends FileWorkType = FileWorkType> {
  readonly rules: readonly FileRecognitionRule<FileTargetByType[T]>[]
}

/**
 * Changes affect later interpretation. An unavailable selected definition remains unavailable
 * instead of triggering fallback.
 */
export type FileRecognitionProfile<T extends FileWorkType = FileWorkType> = {
  [K in T]: {
    readonly id: string
    readonly workType: K
    readonly name: string
    readonly description: string | null

    readonly definition: StoredDefinition<FileRecognitionDefinition<K>>
    readonly sortOrder: number

    /** UTC milliseconds since the Unix epoch. */
    readonly createdAt: number
    /** UTC milliseconds since the Unix epoch. */
    readonly updatedAt: number
  }
}[T]

export interface FileRecognitionProfileFields<T extends FileWorkType> {
  readonly name: string
  readonly description: string | null
  readonly definition: FileRecognitionDefinition<T>
}

/** A fixed recognition definition and display metadata for copying into a new draft. */
export interface FileRecognitionPreset<T extends FileWorkType> {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly definition: FileRecognitionDefinition<T>
}

/**
 * A referenced profile requires explicit handling of its directory dependencies before deletion.
 */
export interface FileRecognitionProfilesApi<T extends FileWorkType> {
  list(
    call?: CallOptions,
  ): Promise<readonly Pick<FileRecognitionProfile<T>, 'id' | 'workType' | 'name' | 'description'>[]>

  /**
   * A missing profile returns null. Corrupted saved definitions remain explicit unavailable values.
   */
  get(id: string, call?: CallOptions): Promise<FileRecognitionProfile<T> | null>

  /** A preset copy uses the same ordinary save path as any complete definition. */
  create(
    input: FileRecognitionProfileFields<T>,
    call?: CallOptions,
  ): Promise<FileRecognitionProfile<T>>

  /**
   * The definition is one comparison value. Updating it leaves saved file associations unchanged.
   */
  update(
    id: string,
    input: {
      readonly changes: Partial<FileRecognitionProfileFields<T>>
      readonly expected?: Partial<FileRecognitionProfileFields<T>>
    },
    call?: CallOptions,
  ): Promise<FileRecognitionProfile<T>>

  /**
   * Deletes an unreferenced profile after its directory dependencies have been handled explicitly.
   */
  delete(id: string, call?: CallOptions): Promise<void>

  /** Reorders selected profiles against the complete media-specific profile-order baseline. */
  reorder(input: ReorderInput, call?: CallOptions): Promise<void>

  references(
    id: string,
    call?: CallOptions,
  ): Promise<
    readonly { readonly work: EntryRef<T>; readonly directoryId: string; readonly path: string }[]
  >

  /** Lists fixed preset definitions for copying into drafts without creating saved profiles. */
  listPresets(call?: CallOptions): Promise<readonly FileRecognitionPreset<T>[]>
}

const numberValue = v.strictObject({ value: text, offset: integer })

const numberOutput = v.variant('kind', [
  v.strictObject({ kind: v.literal('single'), ...numberValue.entries }),
  v.strictObject({ kind: v.literal('range'), start: text, end: text, offset: integer }),
])

const numbered = { number: v.exactOptional(numberOutput), name: v.exactOptional(text) }

const volumeScope = v.pipe(
  v.strictObject({ number: v.exactOptional(numberValue), name: v.exactOptional(text) }),
  v.check((value) => value.number !== undefined || value.name !== undefined),
)

const volume = v.pipe(
  v.strictObject({ kind: v.literal('volume'), ...numbered }),
  v.check((value) => value.number !== undefined || value.name !== undefined),
)

const targetSchemas = {
  anime: v.union([
    v.pipe(
      v.strictObject({
        kind: v.literal('episode'),
        ...numbered,
        episodeType: v.exactOptional(v.nullable(episodeTypeSchema)),
      }),
      v.check((value) => value.number !== undefined || value.name !== undefined),
    ),
    v.strictObject({
      kind: v.literal('extra'),
      name: text,
      extraType: v.exactOptional(v.nullable(extraTypeSchema)),
    }),
  ]),

  comic: v.union([
    volume,
    v.pipe(
      v.strictObject({
        kind: v.literal('chapter'),
        ...numbered,
        numberBasis: v.exactOptional(v.picklist(['work', 'volume'])),
        volume: v.exactOptional(volumeScope),
      }),
      v.check(
        (value) =>
          (value.number !== undefined || value.name !== undefined) &&
          (value.number === undefined
            ? value.numberBasis === undefined
            : value.numberBasis !== undefined) &&
          (value.numberBasis !== 'volume' || value.volume !== undefined),
      ),
    ),
  ]),

  novel: volume,
}

/** The owning rule separately checks template capture names. */
export function parseFileTarget<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileTargetByType[T] {
  return parseValue(
    targetSchemas[workType],
    input,
    'Invalid file recognition target',
  ) as FileTargetByType[T]
}

function targetTemplates(
  target: AnimeFileTarget | ComicFileTarget | NovelFileTarget,
): readonly string[] {
  const templates: string[] = []
  if (target.name !== undefined) {
    templates.push(target.name)
  }
  if ('number' in target && target.number) {
    if (target.number.kind === 'single') {
      templates.push(target.number.value)
    } else {
      templates.push(target.number.start, target.number.end)
    }
  }
  if (target.kind === 'chapter' && target.volume) {
    if (target.volume.name !== undefined) {
      templates.push(target.volume.name)
    }
    if (target.volume.number) {
      templates.push(target.volume.number.value)
    }
  }

  return templates
}

/**
 * Run pattern compilation and capture-name validation in a bounded terminable unit. Disabled rules
 * are validated too. An empty list is valid.
 */
export function parseFileRecognitionDefinition<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileRecognitionDefinition<T> {
  const value = parseFileRecognitionDefinitionShape(workType, input)
  for (const rule of value.rules) {
    const pattern = inspectTextPattern(rule.pattern, rule.ignoreCase)
    for (const target of rule.output.targets) {
      for (const template of targetTemplates(target)) {
        parseTextTemplate(template, pattern.captureNames)
      }
    }
  }

  return value
}

/**
 * Shape validation suits storage and history reads. Execution requires separate isolated pattern
 * compilation.
 */
export function parseFileRecognitionDefinitionShape<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileRecognitionDefinition<T> {
  const target = fromParser((value) => parseFileTarget(workType, value))
  const rule = v.strictObject({
    id,
    name: nonemptyText,
    enabled: v.boolean(),
    input: v.picklist(['baseName', 'path']),
    pattern: text,
    ignoreCase: v.boolean(),
    output: v.strictObject({ targets: v.tupleWithRest([target], target) }),
  })
  const value = parseValue(
    v.strictObject({
      rules: v.pipe(
        v.array(rule),
        v.check((rules) => unique(rules, (rule) => rule.id)),
      ),
    }),
    input,
    'Invalid file recognition definition',
  )
  return value
}

/** The caller compiles submitted definitions in a bounded terminable unit. */
export function parseFileRecognitionProfileUpdate<T extends FileWorkType>(
  workType: T,
  input: unknown,
): {
  readonly changes: Partial<FileRecognitionProfileFields<T>>
  readonly expected?: Partial<FileRecognitionProfileFields<T>>
} {
  const fields = v.strictObject(
    optionalFields({
      name: nonemptyText,
      description: v.nullable(text),
      definition: fromParser((value) => parseFileRecognitionDefinition(workType, value)),
    }),
  )
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

export type FileNumberCondition =
  | { readonly kind: 'single'; readonly value: string }
  | { readonly kind: 'range'; readonly start: string; readonly end: string }

export type NumberedPartCondition =
  | { readonly number: FileNumberCondition; readonly name?: string }
  | { readonly number?: FileNumberCondition; readonly name: string }

export type ComicVolumeScopeCondition =
  | { readonly number: string; readonly name?: string }
  | { readonly number?: string; readonly name: string }

export type FileRecognitionSource =
  | { readonly type: 'builtin' }
  | { readonly type: 'profile'; readonly profileId: string; readonly ruleId: string }

/**
 * A matched result retains its interpretation source, expanded conditions and actual part
 * identities.
 */
export type FileRecognitionResult<T extends FileWorkType = FileWorkType> = {
  [K in T]:
    | {
        readonly outcome: 'matched'
        readonly source: FileRecognitionSource
        readonly conditions: NonEmptyArray<FileConditionByType[K]>
        readonly parts: NonEmptyArray<PartRef<FilePartType<K>>>
      }
    | { readonly outcome: 'unmatched' }
    | {
        readonly outcome: 'failed'
        readonly source: FileRecognitionSource | null
        readonly reason:
          | 'invalidOutput'
          | 'targetMissing'
          | 'ambiguousTarget'
          | 'conflictingInterpretation'
          | 'invalidConfiguration'
          | 'unreadable'
        readonly error: ErrorSummary
      }
}[T]

export type FileReidentificationResult<T extends FileWorkType = FileWorkType> = {
  [K in T]: {
    readonly work: EntryRef<K>
    readonly files: readonly {
      readonly fileId: string
      readonly result: FileRecognitionResult<K>
      readonly changed: boolean
    }[]
  }
}[T]
