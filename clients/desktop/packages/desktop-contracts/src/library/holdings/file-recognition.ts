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

export type FileRecognitionProfile<T extends FileWorkType = FileWorkType> = {
  [K in T]: {
    readonly id: string
    readonly workType: K
    readonly name: string
    readonly description: string | null

    readonly definition: StoredDefinition<FileRecognitionDefinition<K>>
    readonly sortOrder: number

    readonly createdAt: number
    readonly updatedAt: number
  }
}[T]

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

export interface FileRecognitionProfilesApi<T extends FileWorkType> {
  list(
    call?: CallOptions,
  ): Promise<readonly Pick<FileRecognitionProfile<T>, 'id' | 'workType' | 'name' | 'description'>[]>

  get(id: string, call?: CallOptions): Promise<FileRecognitionProfile<T> | null>

  create(
    input: FileRecognitionProfileFields<T>,
    call?: CallOptions,
  ): Promise<FileRecognitionProfile<T>>

  update(
    id: string,
    input: {
      readonly changes: Partial<FileRecognitionProfileFields<T>>
      readonly expected?: Partial<FileRecognitionProfileFields<T>>
    },
    call?: CallOptions,
  ): Promise<FileRecognitionProfile<T>>

  delete(id: string, call?: CallOptions): Promise<void>

  reorder(input: ReorderInput, call?: CallOptions): Promise<void>

  references(
    id: string,
    call?: CallOptions,
  ): Promise<
    readonly { readonly work: EntryRef<T>; readonly directoryId: string; readonly path: string }[]
  >

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
