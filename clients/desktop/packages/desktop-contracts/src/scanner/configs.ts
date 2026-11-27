import * as v from 'valibot'
import { parseAbsolutePath, parsePathFilter, type PathFilter } from '../paths'
import type { NonEmptyArray, StoredValue, CallOptions, Disposable } from '../operations'
import type { ReorderInput } from '../library/ordering'
import {
  parseClueExtractionRuleShape,
  parseClueExtractionRule,
  type ClueExtractionRule,
  type ClueExtractionPreset,
} from './rules'
import {
  fromParser,
  positiveInteger,
  unique,
  id,
  parseValue,
  nonemptyText,
  optionalFields,
  validateExpectedKeys,
} from '../validation'
import { workTypes, languageSchema, type WorkType } from '../library/catalog'
import { parseMetadataProfileDefinition, type MetadataProfileSnapshot } from '../metadata/profiles'

const path = fromParser(parseAbsolutePath)

export interface ScanDefinition {
  readonly entryDepth: number
  readonly inputKinds: NonEmptyArray<'directory' | 'file'>
  readonly include: readonly PathFilter[]
  readonly exclude: readonly PathFilter[]

  readonly identification: {
    readonly rules: readonly ClueExtractionRule[]
    readonly recognizerIds: readonly string[]
  }
}

export interface ScanConfigFields {
  readonly name: string
  readonly rootPath: string
  readonly metadataProfileId: string
  readonly definition: ScanDefinition
  readonly registerExistingContent: boolean
  readonly watchEnabled: boolean
}

export interface ScanConfig<T extends WorkType = WorkType> {
  readonly id: string
  readonly name: string
  readonly workType: T
  readonly rootPath: string
  readonly metadataProfileId: string
  readonly definition: StoredValue<ScanDefinition>
  readonly registerExistingContent: boolean
  readonly watchEnabled: boolean

  readonly sortOrder: number

  readonly createdAt: number
  readonly updatedAt: number
}

export interface ScanConfigCreate {
  readonly name: string
  readonly workType: WorkType

  readonly rootPath: string
  readonly metadataProfileId: string
  readonly definition: ScanDefinition

  readonly registerExistingContent?: boolean
  readonly watchEnabled?: boolean
}

export interface ScanConfigUpdate {
  readonly changes: Partial<ScanConfigFields>
  readonly expected?: Partial<ScanConfigFields>
}

export type ScanConfigSnapshot<T extends WorkType = WorkType> = {
  [K in T]: {
    readonly name: string
    readonly workType: K
    readonly rootPath: string
    readonly definition: ScanDefinition
    readonly registerExistingContent: boolean
    readonly metadataProfile: MetadataProfileSnapshot<K>
  }
}[T]

export interface ScanConfigsApi {
  list<T extends WorkType>(
    filter: { readonly workType: T },
    call?: CallOptions,
  ): Promise<readonly Omit<ScanConfig<T>, 'definition'>[]>
  list(
    filter?: { readonly workType?: WorkType },
    call?: CallOptions,
  ): Promise<readonly Omit<ScanConfig, 'definition'>[]>

  get(id: string, call?: CallOptions): Promise<ScanConfig | null>

  create<I extends ScanConfigCreate>(
    input: I,
    call?: CallOptions,
  ): Promise<ScanConfig<I['workType']>>

  update(id: string, input: ScanConfigUpdate, call?: CallOptions): Promise<ScanConfig>

  delete(id: string, call?: CallOptions): Promise<void>

  reorder(input: ReorderInput, call?: CallOptions): Promise<void>

  listRulePresets(call?: CallOptions): Promise<readonly ClueExtractionPreset[]>

  onInvalidated(listener: () => void): Disposable
}

function definitionSchema(parseRule: typeof parseClueExtractionRuleShape) {
  const kind = v.picklist(['directory', 'file'])
  return v.strictObject({
    entryDepth: positiveInteger,
    inputKinds: v.pipe(
      v.tupleWithRest([kind], kind),
      v.check((kinds) => unique(kinds, (kind) => kind)),
    ),
    include: v.array(fromParser(parsePathFilter)),
    exclude: v.array(fromParser(parsePathFilter)),

    identification: v.strictObject({
      rules: v.pipe(
        v.array(fromParser(parseRule)),
        v.check((rules) => unique(rules, (rule) => rule.id)),
      ),
      recognizerIds: v.pipe(
        v.array(id),
        v.check((ids) => unique(ids, (value) => value)),
      ),
    }),
  })
}

export function parseScanDefinitionShape(input: unknown): ScanDefinition {
  return parseValue(
    definitionSchema(parseClueExtractionRuleShape),
    input,
    'Invalid scanner definition shape',
  )
}

export function parseScanDefinition(input: unknown): ScanDefinition {
  return parseValue(definitionSchema(parseClueExtractionRule), input, 'Invalid scanner definition')
}

export function parseScanConfigCreate(input: unknown): ScanConfigCreate {
  return parseValue(
    v.strictObject({
      name: nonemptyText,
      workType: v.picklist(workTypes),
      rootPath: path,
      metadataProfileId: id,
      definition: fromParser(parseScanDefinition),
      registerExistingContent: v.exactOptional(v.boolean()),
      watchEnabled: v.exactOptional(v.boolean()),
    }),
    input,
    'Invalid scan configuration creation',
  )
}

export function parseScanConfigUpdate(input: unknown): ScanConfigUpdate {
  const fields = v.strictObject(
    optionalFields({
      name: nonemptyText,
      rootPath: path,
      metadataProfileId: id,
      definition: fromParser(parseScanDefinition),
      registerExistingContent: v.boolean(),
      watchEnabled: v.boolean(),
    }),
  )
  const value = parseValue(
    v.strictObject({ changes: fields, expected: v.exactOptional(fields) }),
    input,
    'Invalid scan configuration edit',
  )
  validateExpectedKeys(value.changes, value.expected)
  return value
}

export function parseScanConfigSnapshot(input: unknown): ScanConfigSnapshot {
  const { workType } = parseValue(v.looseObject({ workType: v.picklist(workTypes) }), input)
  return parseValue(
    v.strictObject({
      name: nonemptyText,
      workType: v.literal(workType),
      rootPath: path,
      definition: fromParser(parseScanDefinitionShape),
      registerExistingContent: v.boolean(),
      metadataProfile: v.strictObject({
        id,
        name: nonemptyText,
        entryType: v.literal(workType),
        preferredLanguages: v.array(languageSchema),
        definition: fromParser((value) => parseMetadataProfileDefinition(workType, value)),
      }),
    }),
    input,
    'Invalid scan configuration snapshot',
  ) as ScanConfigSnapshot
}
