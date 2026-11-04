/** @fileoverview Defines complete per-medium filename rules and their pure output semantics for isolated execution. */

import type { FileWorkType, AnimeEpisodeType, AnimeExtraType, EntryRef, PartRef } from '../catalog'

import type { NonEmptyArray, StoredDefinition, CallOptions } from '../../operations'
import type { ReorderInput } from '../ordering'
import * as v from 'valibot'
import {
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

/** Offset is a signed safe integer subtracted from the integer portion after template expansion. */
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

export type ComicVolumeScopeOutput =
  | { readonly number: FileNumberValue; readonly name?: string }
  | { readonly number?: FileNumberValue; readonly name: string }

export type AnimeFileTarget =
  | (NumberedPartOutput & {
      readonly kind: 'episode'
      readonly episodeType?: AnimeEpisodeType | null
    })
  | { readonly kind: 'extra'; readonly name: string; readonly extraType?: AnimeExtraType | null }

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

/** The first enabled full match owns the entire interpretation; targets are jointly required, not fallback candidates. */
export interface FileRecognitionRule<TTarget> {
  readonly id: string
  readonly name: string
  readonly enabled: boolean

  readonly input: 'baseName' | 'path'
  readonly pattern: string
  readonly ignoreCase: boolean

  readonly output: { readonly targets: NonEmptyArray<TTarget> }
}

export interface FileRecognitionDefinition<T extends FileWorkType = FileWorkType> {
  readonly rules: readonly FileRecognitionRule<FileTargetByType[T]>[]
}

/** Definition changes affect later interpretation; a broken selected profile never means fallback to builtin recognition. */
export interface FileRecognitionProfile<T extends FileWorkType = FileWorkType> {
  readonly id: string
  readonly workType: T
  readonly name: string
  readonly description: string | null
  readonly definition: StoredDefinition<FileRecognitionDefinition<T>>
  readonly sortOrder: number
  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

export interface FileRecognitionProfileFields<T extends FileWorkType> {
  readonly name: string
  readonly description: string | null
  readonly definition: FileRecognitionDefinition<T>
}

export interface FileRecognitionPreset<T extends FileWorkType> {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly definition: FileRecognitionDefinition<T>
}

/** Shared profiles are independently managed. Referenced profiles cannot be deleted or silently replaced. */
export interface FileRecognitionProfilesApi<T extends FileWorkType> {
  /** Read saved profile identities and descriptions for this media type in formal order. */
  list(
    call?: CallOptions,
  ): Promise<readonly Pick<FileRecognitionProfile<T>, 'id' | 'workType' | 'name' | 'description'>[]>

  /**
   * Read the profile and its saved definition, retaining corruption as an explicit unavailable
   * value.
   */
  get(id: string, call?: CallOptions): Promise<FileRecognitionProfile<T> | null>

  /**
   * Create an independent profile from a complete definition; presets and copies enter through
   * the same ordinary save path.
   */
  create(
    input: FileRecognitionProfileFields<T>,
    call?: CallOptions,
  ): Promise<FileRecognitionProfile<T>>

  /**
   * Compare and save changed profile fields, treating the definition as one value; existing file
   * associations are not rewritten by the save.
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
   * Delete only an unreferenced profile; referencing content directories must be handled
   * explicitly before removal.
   */
  delete(id: string, call?: CallOptions): Promise<void>

  /** Reorder selected profiles against the complete media-specific directory baseline. */
  reorder(input: ReorderInput, call?: CallOptions): Promise<void>

  /**
   * Read actual content directories that reference this profile so callers can resolve
   * dependencies before deletion.
   */
  references(
    id: string,
    call?: CallOptions,
  ): Promise<
    readonly { readonly work: EntryRef<T>; readonly directoryId: string; readonly path: string }[]
  >

  /** Read fixed definitions for copying into a draft; listing presets creates no saved profiles. */
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

/** Parse the medium's fixed output structure. Templates are checked against the owning rule's captures separately. */
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
 * Validate every rule, including disabled ones, in a bounded terminable unit because patterns are compiled.
 * An empty rule list is valid; invalid selected definitions never become an empty list.
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

/** Decode the closed value without compiling patterns; codecs/history reads cannot substitute this for isolated execution validation. */
export function parseFileRecognitionDefinitionShape<T extends FileWorkType>(
  workType: T,
  input: unknown,
): FileRecognitionDefinition<T> {
  const target = v.pipe(
    v.unknown(),
    v.transform((value) => parseFileTarget(workType, value)),
  )
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

/** Validate a profile's actual changed fields, compiling a submitted definition within the caller's isolated unit. */
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
      definition: v.pipe(
        v.unknown(),
        v.transform((value) => parseFileRecognitionDefinition(workType, value)),
      ),
    }),
  )
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

/** Already expanded labels; the matcher never reinterprets templates or applies the offset again. */
export type FileNumberCondition =
  | { readonly kind: 'single'; readonly value: string }
  | { readonly kind: 'range'; readonly start: string; readonly end: string }

export type NumberedPartCondition =
  | { readonly number: FileNumberCondition; readonly name?: string }
  | { readonly number?: FileNumberCondition; readonly name: string }

export type ComicVolumeScopeCondition =
  | { readonly number: string; readonly name?: string }
  | { readonly number?: string; readonly name: string }

/** A recognition source is one complete interpretation, never a mixture of builtin and custom fields. */
export type FileRecognitionSource =
  | { readonly type: 'builtin' }
  | { readonly type: 'profile'; readonly profileId: string; readonly ruleId: string }

export type FileRecognitionResult<T extends FileWorkType = FileWorkType> =
  | {
      readonly outcome: 'matched'
      readonly source: FileRecognitionSource
      readonly conditions: NonEmptyArray<FileConditionByType[T]>
      readonly parts: NonEmptyArray<PartRef<FilePartType<T>>>
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

export interface FileReidentificationResult<T extends FileWorkType = FileWorkType> {
  readonly work: EntryRef<T>
  readonly files: readonly {
    readonly fileId: string
    readonly result: FileRecognitionResult<T>
    readonly changed: boolean
  }[]
}
