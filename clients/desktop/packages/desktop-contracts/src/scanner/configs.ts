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

/**
 * Candidate discovery and clue-extraction rules for one scan configuration.
 *
 * Matching files to an existing work's parts belongs to holdings.
 */
export interface ScanDefinition {
  /** Positive candidate depth from the discovery root; 1 selects direct children. */
  readonly entryDepth: number
  readonly inputKinds: NonEmptyArray<'directory' | 'file'>
  /** Alternative inclusion filters; an empty list adds no restriction. */
  readonly include: readonly PathFilter[]
  /**
   * Alternative exclusions applied before inclusion; an excluded directory also excludes its
   * subtree.
   */
  readonly exclude: readonly PathFilter[]

  readonly identification: {
    readonly rules: readonly ClueExtractionRule[]
    readonly recognizerIds: readonly string[]
  }
}

/**
 * Editable scan configuration fields, including the complete discovery and identification
 * definition.
 */
export interface ScanConfigFields {
  readonly name: string
  readonly rootPath: string
  readonly metadataProfileId: string
  readonly definition: ScanDefinition
  readonly registerExistingContent: boolean
  readonly watchEnabled: boolean
}

/** Saved scan configuration with explicit definition validity and formal order. */
export interface ScanConfig<T extends WorkType = WorkType> {
  readonly id: string
  readonly name: string
  readonly workType: T
  readonly rootPath: string
  readonly metadataProfileId: string
  readonly definition: StoredDefinition<ScanDefinition>
  readonly registerExistingContent: boolean
  readonly watchEnabled: boolean

  readonly sortOrder: number

  /** UTC milliseconds since the Unix epoch. */
  readonly createdAt: number
  /** UTC milliseconds since the Unix epoch. */
  readonly updatedAt: number
}

/**
 * Input for a new configuration with a fixed work medium.
 *
 * Existing-content registration defaults to false and watch activation defaults to true.
 */
export interface ScanConfigCreate {
  readonly name: string
  readonly workType: WorkType

  readonly rootPath: string
  readonly metadataProfileId: string
  readonly definition: ScanDefinition

  readonly registerExistingContent?: boolean
  readonly watchEnabled?: boolean
}

/** Scan configuration field edits with optional original values for comparison. */
export interface ScanConfigUpdate {
  readonly changes: Partial<ScanConfigFields>
  readonly expected?: Partial<ScanConfigFields>
}

/** Configuration and metadata profile captured for one accepted scan and retained in its report. */
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

/** Saved scanner configuration management and native extraction preset discovery. */
export interface ScanConfigsApi {
  /** Reads configuration summaries in formal order, optionally restricted to one work medium. */
  list<T extends WorkType>(
    filter: { readonly workType: T },
    call?: CallOptions,
  ): Promise<readonly Omit<ScanConfig<T>, 'definition'>[]>
  list(
    filter?: { readonly workType?: WorkType },
    call?: CallOptions,
  ): Promise<readonly Omit<ScanConfig, 'definition'>[]>

  /**
   * Reads a complete saved configuration, returning null when absent.
   *
   * Invalid definitions and unavailable references remain explicit.
   */
  get(id: string, call?: CallOptions): Promise<ScanConfig | null>

  /**
   * Commits a configuration before separately owned watch and initial-scan adoption.
   *
   * Saved success does not establish success of those later operations.
   */
  create<I extends ScanConfigCreate>(
    input: I,
    call?: CallOptions,
  ): Promise<ScanConfig<I['workType']>>

  /**
   * Compares and commits changed fields.
   *
   * Accepted scans retain their captured configuration while later work adopts the new values.
   */
  update(id: string, input: ScanConfigUpdate, call?: CallOptions): Promise<ScanConfig>

  /**
   * Removes the saved configuration and future watch input.
   *
   * Accepted work and established library facts retain their own lifetimes.
   */
  delete(id: string, call?: CallOptions): Promise<void>

  /** Reorders selected configurations against the complete saved directory baseline. */
  reorder(input: ReorderInput, call?: CallOptions): Promise<void>

  /** Reads fixed native clue-extraction presets for copying into a draft. */
  listRulePresets(call?: CallOptions): Promise<readonly ClueExtractionPreset[]>

  /**
   * Subscribes to configuration-directory invalidation and returns the subscription lifetime.
   *
   * Callers subscribe before reading; runtime state has its own observation API.
   */
  onInvalidated(listener: () => void): Disposable
}

/** Builds the scan-definition schema using the supplied level of extraction-rule validation. */
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

/**
 * Parses stored definition structure without compiling user regular expressions.
 *
 * Saving or execution requires full definition validation.
 */
export function parseScanDefinitionShape(input: unknown): ScanDefinition {
  return parseValue(
    definitionSchema(parseClueExtractionRuleShape),
    input,
    'Invalid scanner definition shape',
  )
}

/**
 * Parses a scan definition and validates all patterns and capture references, including disabled
 * rules.
 *
 * Callers run this validator in a bounded, terminable execution unit.
 */
export function parseScanDefinition(input: unknown): ScanDefinition {
  return parseValue(definitionSchema(parseClueExtractionRule), input, 'Invalid scanner definition')
}

/**
 * Parses a new configuration with full definition validation.
 *
 * The caller supplies a bounded, terminable validation unit; the configuration owner checks profile
 * existence, matching work type and path accessibility.
 */
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

/**
 * Parses editable configuration fields and their baselines, treating definition as one complete
 * value.
 *
 * Definition validation runs in a caller-owned bounded, terminable unit. Work type, ordering and
 * timestamps are outside ordinary edits.
 */
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

/**
 * Parses historical rule structure without compiling patterns and checks the captured profile's
 * work type.
 */
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
