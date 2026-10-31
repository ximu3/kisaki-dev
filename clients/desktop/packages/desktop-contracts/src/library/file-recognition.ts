/** @fileoverview Defines medium-specific file interpretation rules and exact number-label transformations. */

import * as v from 'valibot'
import type { DefinitionRead } from '../definition'
import { invalidInput } from '../errors'
import type { CallOptions, Disposable } from '../execution'
import { objectSchema } from '../schema'
import { textTemplateSchema, validateTemplateReferences } from '../text-rules'
import { nonemptyStringSchema, parseContract, safeIntegerSchema } from '../validation'
import type { OrderChange } from './ordering'
import type { EntryRef } from './identity'
import {
  animeEpisodeTypes,
  animeExtraTypes,
  type AnimeEpisodeType,
  type AnimeExtraType,
} from './parts'

/** File media share mechanics but retain different target semantics and persistent ownership. */
export type FileWorkType = 'anime' | 'comic' | 'novel'
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
  | { readonly number?: never; readonly name: string }
export type ComicVolumeScopeOutput =
  | { readonly number: FileNumberValue; readonly name?: string }
  | { readonly number?: never; readonly name: string }
export type AnimeFileTarget =
  | (NumberedPartOutput & {
      readonly kind: 'episode'
      readonly episodeType?: AnimeEpisodeType | null
    })
  | { readonly kind: 'extra'; readonly name: string; readonly extraType?: AnimeExtraType | null }
export type ComicFileTarget =
  | (NumberedPartOutput & { readonly kind: 'volume' })
  | ({ readonly kind: 'chapter' } & (
      | {
          readonly number: FileNumberOutput
          readonly name?: string
          readonly numberBasis: 'work'
          readonly volume?: ComicVolumeScopeOutput
        }
      | {
          readonly number: FileNumberOutput
          readonly name?: string
          readonly numberBasis: 'volume'
          readonly volume: ComicVolumeScopeOutput
        }
      | {
          readonly number?: never
          readonly name: string
          readonly numberBasis?: never
          readonly volume?: ComicVolumeScopeOutput
        }
    ))
export type NovelFileTarget = NumberedPartOutput & { readonly kind: 'volume' }
export interface FileTargetByType {
  readonly anime: AnimeFileTarget
  readonly comic: ComicFileTarget
  readonly novel: NovelFileTarget
}
/** Definitions contain templates; kinds, classifications, number bases, and offsets remain fixed values. */
export interface FileRecognitionRule<Target> {
  readonly id: string
  readonly name: string
  readonly enabled: boolean
  readonly input: 'baseName' | 'path'
  readonly pattern: string
  readonly ignoreCase: boolean
  readonly output: { readonly targets: readonly [Target, ...Target[]] }
}
export interface FileRecognitionDefinition<Type extends FileWorkType = FileWorkType> {
  readonly rules: readonly FileRecognitionRule<FileTargetByType[Type]>[]
}
export interface FileRecognitionProfile<Type extends FileWorkType = FileWorkType> {
  readonly id: string
  readonly workType: Type
  readonly name: string
  readonly description: string | null
  readonly definition: DefinitionRead<FileRecognitionDefinition<Type>>
  readonly sortOrder: number
  readonly createdAt: number
  readonly updatedAt: number
}
export interface FileRecognitionProfileChanges<Type extends FileWorkType> {
  readonly name?: string
  readonly description?: string | null
  readonly definition?: FileRecognitionDefinition<Type>
}
export interface FileRecognitionProfilesApi {
  /** Read fixed medium-specific rule presets without saving, discovering files, or modifying associations. */
  listPresets(type: FileWorkType, call?: CallOptions): Promise<readonly FileRecognitionPreset[]>
  /** Read actual directories referencing this profile, without treating a copied draft as a reference. */
  listDirectories(
    type: FileWorkType,
    id: string,
    call?: CallOptions,
  ): Promise<
    readonly { readonly id: string; readonly work: EntryRef<FileWorkType>; readonly path: string }[]
  >
  /** Read saved profile summaries for the actual medium, including reference counts. */
  list(
    type: FileWorkType,
    call?: CallOptions,
  ): Promise<
    readonly (Omit<FileRecognitionProfile, 'definition'> & { readonly referenceCount: number })[]
  >
  /** Return the definition state, or null; invalid selected definitions never become builtin recognition. */
  get(type: FileWorkType, id: string, call?: CallOptions): Promise<FileRecognitionProfile | null>
  /** Validate all rules in the bounded isolated executor, then save a new independent profile. */
  create<Type extends FileWorkType>(
    type: Type,
    input: {
      readonly name: string
      readonly description?: string | null
      readonly definition: FileRecognitionDefinition<Type>
    },
    call?: CallOptions,
  ): Promise<FileRecognitionProfile<Type>>
  /** Save related fields once; complete rule validation includes disabled items and declared capture names. */
  update<Type extends FileWorkType>(
    type: Type,
    id: string,
    input: {
      readonly changes: FileRecognitionProfileChanges<Type>
      readonly expected?: FileRecognitionProfileChanges<Type>
    },
    call?: CallOptions,
  ): Promise<FileRecognitionProfile<Type>>
  /** Reject deletion while any real directory refers to the profile. */
  delete(type: FileWorkType, id: string, call?: CallOptions): Promise<void>
  /** Change one medium's saved order without changing any directory selection. */
  reorder(type: FileWorkType, input: OrderChange, call?: CallOptions): Promise<void>
  /** Observe saved catalog changes, independently of file recognition progress. */
  onInvalidated(listener: () => void): Disposable
}

/** A copied preset becomes an independent ordinary definition with new rule identities. */
export interface FileRecognitionPreset<Type extends FileWorkType = FileWorkType> {
  readonly id: string
  readonly workType: Type
  readonly name: string
  readonly description: string
  readonly definition: FileRecognitionDefinition<Type>
}

const offset = safeIntegerSchema
const numberValue = objectSchema({ value: textTemplateSchema, offset })
const numberOutput = v.union([
  objectSchema({ kind: v.literal('single'), value: textTemplateSchema, offset }),
  objectSchema({
    kind: v.literal('range'),
    start: textTemplateSchema,
    end: textTemplateSchema,
    offset,
  }),
])
const numbered = { number: numberOutput, name: v.exactOptional(textTemplateSchema) }
const named = { name: textTemplateSchema }
const volumeScope = v.union([
  objectSchema({ number: numberValue, name: v.exactOptional(textTemplateSchema) }),
  objectSchema(named),
])
const volume = v.union([
  objectSchema({ kind: v.literal('volume'), ...numbered }),
  objectSchema({ kind: v.literal('volume'), ...named }),
])
const animeTarget = v.union([
  objectSchema({
    kind: v.literal('episode'),
    ...numbered,
    episodeType: v.exactOptional(v.nullable(v.picklist(animeEpisodeTypes))),
  }),
  objectSchema({
    kind: v.literal('episode'),
    ...named,
    episodeType: v.exactOptional(v.nullable(v.picklist(animeEpisodeTypes))),
  }),
  objectSchema({
    kind: v.literal('extra'),
    ...named,
    extraType: v.exactOptional(v.nullable(v.picklist(animeExtraTypes))),
  }),
])
const comicTarget = v.union([
  volume,
  objectSchema({
    kind: v.literal('chapter'),
    ...numbered,
    numberBasis: v.literal('work'),
    volume: v.exactOptional(volumeScope),
  }),
  objectSchema({
    kind: v.literal('chapter'),
    ...numbered,
    numberBasis: v.literal('volume'),
    volume: volumeScope,
  }),
  objectSchema({ kind: v.literal('chapter'), ...named, volume: v.exactOptional(volumeScope) }),
])
function definition<Target>(target: v.GenericSchema<unknown, Target>) {
  return objectSchema({
    rules: v.pipe(
      v.array(
        objectSchema({
          id: nonemptyStringSchema,
          name: nonemptyStringSchema,
          enabled: v.boolean(),
          input: v.picklist(['baseName', 'path']),
          pattern: v.string(),
          ignoreCase: v.boolean(),
          output: objectSchema({
            targets: v.pipe(v.tupleWithRest([target], target), v.readonly()),
          }),
        }),
      ),
      v.check((rules) => new Set(rules.map((rule) => rule.id)).size === rules.length),
      v.readonly(),
    ),
  })
}
export const fileRecognitionSchemas: {
  [Type in FileWorkType]: v.GenericSchema<unknown, FileRecognitionDefinition<Type>>
} = { anime: definition(animeTarget), comic: definition(comicTarget), novel: definition(volume) }

/** Parse target and template structure. The saving owner must additionally validate patterns in its cancellable executor. */
export function parseFileRecognitionDefinition<Type extends FileWorkType>(
  type: Type,
  input: unknown,
): FileRecognitionDefinition<Type> {
  return parseContract(fileRecognitionSchemas[type], input, 'file recognition definition')
}

/** Check all target templates against the isolated pattern's actual group declarations. */
export function validateFileTargetReferences(
  target: AnimeFileTarget | ComicFileTarget | NovelFileTarget,
  names: ReadonlySet<string>,
): void {
  if (target.name !== undefined) {
    validateTemplateReferences(target.name, names)
  }
  if ('number' in target && target.number) {
    if (target.number.kind === 'single') {
      validateTemplateReferences(target.number.value, names)
    } else {
      validateTemplateReferences(target.number.start, names)
      validateTemplateReferences(target.number.end, names)
    }
  }
  if (target.kind === 'chapter' && target.volume) {
    if (target.volume.name !== undefined) {
      validateTemplateReferences(target.volume.name, names)
    }
    if (target.volume.number) {
      validateTemplateReferences(target.volume.number.value, names)
    }
  }
}

/** Apply only a declared offset to an expanded label, using exact integer arithmetic and retaining the decimal suffix. */
export function applyFileNumberOffset(value: string, offset: number): string {
  parseContract(safeIntegerSchema, offset, 'file number offset')
  const text = value.trim()
  if (!text) {
    return invalidInput('The file number is empty.')
  }
  if (offset === 0) {
    return value
  }
  const match = /^([0-9]+)(\.[0-9]+)?$/.exec(text)
  if (!match) {
    return invalidInput('This file number does not support an offset.')
  }
  const integer = BigInt(match[1]!) - BigInt(offset)
  if (integer < 0n) {
    return invalidInput('A file number offset produced a negative number.')
  }
  return `${integer}${match[2] ?? ''}`
}

/** Compare numbering text under the file contract, without changing stored labels or claiming unique matching. */
export function fileNumberLabelsEqual(left: string, right: string): boolean {
  const a = left.trim()
  const b = right.trim()
  if (/^[0-9]+$/.test(a) && /^[0-9]+$/.test(b)) {
    return BigInt(a) === BigInt(b)
  }
  return a === b
}
