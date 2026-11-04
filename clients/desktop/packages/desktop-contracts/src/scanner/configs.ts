/** @fileoverview Defines complete scan configuration values, changes and retained snapshots. */

import * as v from 'valibot'
import { parseAbsolutePath, parsePathFilter } from '../paths'
import type { NonEmptyArray, StoredDefinition, CallOptions, Disposable } from '../operations'
import type { PathFilter } from '../paths'
import type { ClueExtractionRule, ClueExtractionPreset } from './rules'
import type { WorkType } from '../library/catalog'
import type { MetadataProfileSnapshot } from '../metadata/profiles'
import type { ReorderInput } from '../library/ordering'
import { parseClueExtractionRuleShape, parseClueExtractionRule } from './rules'
import {
  positiveInteger,
  unique,
  id,
  parseValue,
  nonemptyText,
  optionalFields,
  validateExpectedKeys,
} from '../validation'
import { workTypes, languageSchema } from '../library/catalog'
import { parseMetadataProfileDefinition } from '../metadata/profiles'

const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))

/** Candidate discovery and clue extraction remain separate from holdings' existing-part matching. */
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

export interface ScanConfig {
  readonly id: string
  readonly name: string
  readonly workType: WorkType
  readonly rootPath: string
  readonly metadataProfileId: string
  readonly definition: StoredDefinition<ScanDefinition>
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

export interface ScanConfigSnapshot {
  readonly name: string
  readonly workType: WorkType
  readonly rootPath: string
  readonly definition: ScanDefinition
  readonly registerExistingContent: boolean
  readonly metadataProfile: MetadataProfileSnapshot<WorkType>
}

/** Configuration summaries omit complete definitions. Ordinary creation/updates own later watch/initial-scan work separately. */
export interface ScanConfigsApi {
  list(
    filter?: { readonly workType?: WorkType },
    call?: CallOptions,
  ): Promise<readonly Omit<ScanConfig, 'definition'>[]>
  get(id: string, call?: CallOptions): Promise<ScanConfig | null>

  create(input: ScanConfigCreate, call?: CallOptions): Promise<ScanConfig>
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
    include: v.array(v.pipe(v.unknown(), v.transform(parsePathFilter))),
    exclude: v.array(v.pipe(v.unknown(), v.transform(parsePathFilter))),

    identification: v.strictObject({
      rules: v.pipe(
        v.array(v.pipe(v.unknown(), v.transform(parseRule))),
        v.check((rules) => unique(rules, (rule) => rule.id)),
      ),
      recognizerIds: v.pipe(
        v.array(id),
        v.check((ids) => unique(ids, (value) => value)),
      ),
    }),
  })
}

/** Decode closed definition values without compiling user regexes; appropriate for stored snapshots and synchronous codecs. */
export function parseScanDefinitionShape(input: unknown): ScanDefinition {
  return parseValue(
    definitionSchema(parseClueExtractionRuleShape),
    input,
    'Invalid scanner definition shape',
  )
}

/** Full save/execution validation, including disabled patterns and capture references, must run in a terminable bounded unit. */
export function parseScanDefinition(input: unknown): ScanDefinition {
  return parseValue(definitionSchema(parseClueExtractionRule), input, 'Invalid scanner definition')
}

/** Validate a new configuration; actual same-type profile existence and path accessibility are checked by its owner. */
export function parseScanConfigCreate(input: unknown): ScanConfigCreate {
  return parseValue(
    v.strictObject({
      name: nonemptyText,
      workType: v.picklist(workTypes),
      rootPath: path,
      metadataProfileId: id,
      definition: v.pipe(v.unknown(), v.transform(parseScanDefinition)),
      registerExistingContent: v.exactOptional(v.boolean()),
      watchEnabled: v.exactOptional(v.boolean()),
    }),
    input,
    'Invalid scan configuration creation',
  )
}

/** Ordinary editing cannot change workType or technical ordering/timestamps; a submitted definition is one save unit. */
export function parseScanConfigUpdate(input: unknown): ScanConfigUpdate {
  const fields = v.strictObject(
    optionalFields({
      name: nonemptyText,
      rootPath: path,
      metadataProfileId: id,
      definition: v.pipe(v.unknown(), v.transform(parseScanDefinition)),
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

/** Decode historical rule structure without executing it, and verify the fixed metadata profile has the same work type. */
export function parseScanConfigSnapshot(input: unknown): ScanConfigSnapshot {
  const { workType } = parseValue(v.looseObject({ workType: v.picklist(workTypes) }), input)
  return parseValue(
    v.strictObject({
      name: nonemptyText,
      workType: v.literal(workType),
      rootPath: path,
      definition: v.pipe(v.unknown(), v.transform(parseScanDefinitionShape)),
      registerExistingContent: v.boolean(),
      metadataProfile: v.strictObject({
        id,
        name: nonemptyText,
        entryType: v.literal(workType),
        preferredLanguages: v.array(languageSchema),
        definition: v.pipe(
          v.unknown(),
          v.transform((value) => parseMetadataProfileDefinition(workType, value)),
        ),
      }),
    }),
    input,
    'Invalid scan configuration snapshot',
  ) as ScanConfigSnapshot
}
