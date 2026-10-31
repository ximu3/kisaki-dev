/** @fileoverview Defines saved scanner intent, whole-rule validation, and independent configuration management. */

import * as v from 'valibot'
import { parseContributionId } from '@kisaki3/extension-distribution/identity'
import type { DefinitionRead } from '../definition'
import type { CallOptions, Disposable } from '../execution'
import { workTypes, type WorkType } from '../library/identity'
import type { OrderChange } from '../library/ordering'
import { absolutePathSchema, pathFilterSchema, type PathFilter } from '../paths'
import { objectSchema } from '../schema'
import {
  exactPartialEntries,
  hasRelatedExpected,
  nonemptyStringSchema,
  nonnegativeIntegerSchema,
  parseContract,
} from '../validation'
import { clueExtractionRuleSchema, type ClueExtractionRule } from './rules'

/** Exactly one candidate depth, finite path filters, and explicitly selected clue implementations. */
export interface ScanDefinition {
  readonly entryDepth: number
  readonly inputKinds: readonly ['directory' | 'file', ...('directory' | 'file')[]]
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
export interface ScanConfig extends Omit<ScanConfigFields, 'definition'> {
  readonly id: string
  readonly workType: WorkType
  readonly definition: DefinitionRead<ScanDefinition>
  readonly sortOrder: number
  readonly createdAt: number
  readonly updatedAt: number
}
export type ScanConfigSummary = Omit<ScanConfig, 'definition'>
export type ScanConfigCreate = Omit<
  ScanConfigFields,
  'registerExistingContent' | 'watchEnabled'
> & {
  readonly workType: WorkType
  readonly registerExistingContent?: boolean
  readonly watchEnabled?: boolean
}
export interface ScanConfigUpdate {
  readonly changes: Partial<ScanConfigFields>
  readonly expected?: Partial<ScanConfigFields>
}
export interface ScanConfigsApi {
  /** Read summaries in saved order; definitions and execution history have separate reads. */
  list(
    filter?: { readonly workType?: WorkType },
    call?: CallOptions,
  ): Promise<readonly ScanConfigSummary[]>
  /** Read an actual configuration, preserving invalid definitions, or null. */
  get(id: string, call?: CallOptions): Promise<ScanConfig | null>
  /** Save complete rules; watch defaults true and registerExistingContent defaults false. Valid enabled saves arrange the normal watch/scan flow. */
  create(input: ScanConfigCreate, call?: CallOptions): Promise<ScanConfig>
  /** Compare related baselines and replace whole definitions; admitted runs retain their fixed original snapshots. */
  update(id: string, input: ScanConfigUpdate, call?: CallOptions): Promise<ScanConfig>
  /** Remove future intent, retaining admitted execution, formal library contents, and past reports. */
  delete(id: string, call?: CallOptions): Promise<void>
  /** Reorder the actual configuration set against its complete original order. */
  reorder(input: OrderChange, call?: CallOptions): Promise<void>
  /** Add one exact exclusion only when the current root still matches the explicit report basis. */
  excludePath(
    id: string,
    input: { readonly rootPath: string; readonly relativePath: string },
    call?: CallOptions,
  ): Promise<ScanConfig>
  /** Notify consumers of saved configuration changes, independently of run progress. */
  onInvalidated(listener: () => void): Disposable
}
const recognizerId = v.pipe(
  nonemptyStringSchema,
  v.check((value) => {
    try {
      parseContributionId(value)
      return true
    } catch {
      return false
    }
  }),
)
const definitionSchema: v.GenericSchema<unknown, ScanDefinition> = objectSchema({
  entryDepth: v.pipe(nonnegativeIntegerSchema, v.minValue(1)),
  inputKinds: v.pipe(
    v.tupleWithRest([v.picklist(['directory', 'file'])], v.picklist(['directory', 'file'])),
    v.check((values) => new Set(values).size === values.length),
    v.readonly(),
  ),
  include: v.pipe(v.array(pathFilterSchema), v.readonly()),
  exclude: v.pipe(v.array(pathFilterSchema), v.readonly()),
  identification: objectSchema({
    rules: v.pipe(
      v.array(clueExtractionRuleSchema),
      v.check((rules) => new Set(rules.map((rule) => rule.id)).size === rules.length),
      v.readonly(),
    ),
    recognizerIds: v.pipe(
      v.array(recognizerId),
      v.check((ids) => new Set(ids).size === ids.length),
      v.readonly(),
    ),
  }),
})
/** Validate all rule shapes, including disabled rules. The saving owner must also compile patterns in its cancellable isolated executor. */
export function parseScanDefinition(input: unknown): ScanDefinition {
  return parseContract(definitionSchema, input, 'scan definition')
}
/** Create a fresh first-level draft with explicitly chosen input kinds and no adopted presets or recognizers. */
export function createScanDefinition(inputKinds: ScanDefinition['inputKinds']): ScanDefinition {
  return parseScanDefinition({
    entryDepth: 1,
    inputKinds,
    include: [],
    exclude: [],
    identification: { rules: [], recognizerIds: [] },
  })
}
const configFields = {
  name: nonemptyStringSchema,
  rootPath: absolutePathSchema,
  metadataProfileId: nonemptyStringSchema,
  definition: definitionSchema,
  registerExistingContent: v.boolean(),
  watchEnabled: v.boolean(),
}
/** Validate explicit creation values without requiring a source extension to be active during configuration editing. */
export function parseScanConfigCreate(input: unknown): ScanConfigCreate {
  return parseContract(
    objectSchema({
      ...configFields,
      workType: v.picklist(workTypes),
      registerExistingContent: v.exactOptional(v.boolean()),
      watchEnabled: v.exactOptional(v.boolean()),
    }),
    input,
    'scan configuration creation',
  )
}
/** Validate only changed fields and their related original values; work type and technical observations are immutable here. */
export function parseScanConfigUpdate(input: unknown): ScanConfigUpdate {
  const fields = objectSchema(exactPartialEntries(configFields))
  return parseContract(
    v.pipe(
      objectSchema({ changes: fields, expected: v.exactOptional(fields) }),
      v.check((value) => hasRelatedExpected(value.changes, value.expected)),
    ),
    input,
    'scan configuration update',
  )
}
