/** @fileoverview Defines content directory discovery, editing and relocation values. */

import type { PathFilter } from '../../paths'
import type { WorkType, EntryRef, WorkRef, FileWorkType } from '../catalog'

import type { StoredDefinition, NonEmptyArray, CallOptions } from '../../operations'
import type { ErrorSummary } from '../../errors'
import * as v from 'valibot'
import { parseAbsolutePath, parsePathFilter } from '../../paths'
import {
  positiveInteger,
  parseValue,
  id,
  optionalFields,
  validateExpectedKeys,
  unique,
} from '../../validation'
import { DesktopError } from '../../errors'

/**
 * A content directory's depth and path filters for discovering new files.
 *
 * These settings preserve existing registrations and leave naming-profile selection separate.
 */
export interface DirectoryDiscoveryDefinition {
  /**
   * Positive safe-integer depth: 1 includes direct children; null allows recursive discovery
   * without a depth limit.
   */
  readonly maxDepth: number | null
  readonly include: readonly PathFilter[]
  readonly exclude: readonly PathFilter[]
}

/**
 * A work-owned local directory with stable identity and media-specific discovery configuration.
 *
 * A null recognitionProfileId selects built-in recognition only.
 */
export type ContentDirectory<T extends WorkType = WorkType> = {
  [K in T]: {
    readonly id: string
    readonly work: EntryRef<K>
    readonly path: string
    /** UTC milliseconds since the Unix epoch. */
    readonly createdAt: number
    /** UTC milliseconds since the Unix epoch. */
    readonly updatedAt: number
  } & (K extends FileWorkType
    ? {
        readonly definition: StoredDefinition<DirectoryDiscoveryDefinition>
        readonly recognitionProfileId: string | null
      }
    : object)
}[T]

/**
 * A local directory path and optional discovery settings for the applicable medium.
 *
 * File-bearing directories default to unlimited depth, empty include/exclude lists and built-in
 * recognition.
 */
export type DirectoryCreateFields<T extends WorkType = WorkType> = {
  [K in T]: { readonly path: string } & (K extends FileWorkType
    ? {
        readonly definition?: DirectoryDiscoveryDefinition
        readonly recognitionProfileId?: string | null
      }
    : object)
}[T]

/**
 * Discovery or recognition-profile changes with matching expected values.
 *
 * Path changes use the explicit relocation operation.
 */
export interface DirectoryUpdate {
  readonly changes: {
    readonly definition?: DirectoryDiscoveryDefinition
    readonly recognitionProfileId?: string | null
  }
  readonly expected?: {
    readonly definition?: DirectoryDiscoveryDefinition
    readonly recognitionProfileId?: string | null
  }
}

/**
 * A new registered directory path and explicitly selected related path mappings.
 *
 * Commands and historical text are outside the relocation scope.
 */
export interface DirectoryRelocationInput {
  readonly path: string
  readonly expected?: { readonly path: string }

  readonly gameConfigFields?: readonly {
    readonly launchConfigId: string
    readonly fields: NonEmptyArray<'launchPath' | 'workingDirectory' | 'monitorPath' | 'savePath'>
  }[]

  readonly subtitlePaths?: readonly {
    readonly fileId: string
    readonly paths: NonEmptyArray<string>
  }[]
}

/** A registered directory, file, launch field or subtitle path addressed by relocation. */
export type RelocatedPathTarget =
  | { readonly type: 'directory' | 'file'; readonly id: string }
  | {
      readonly type: 'launchConfig'
      readonly id: string
      readonly field: 'launchPath' | 'workingDirectory' | 'monitorPath' | 'savePath'
    }
  | { readonly type: 'subtitle'; readonly fileId: string; readonly path: string }

/**
 * Applied path mappings and unresolved verification, availability or conflict issues for a work.
 */
export interface HoldingsRelocationResult {
  readonly work: WorkRef

  readonly updated: readonly {
    readonly target: RelocatedPathTarget
    readonly from: string
    readonly to: string
  }[]

  readonly issues: readonly {
    readonly target: RelocatedPathTarget
    readonly path: string
    readonly status: 'unverified' | 'unavailable' | 'conflict'
    readonly error: ErrorSummary
  }[]
}

/**
 * Work-owned directory registration, discovery configuration and path relocation.
 *
 * Deletion preserves files and configurations. Relocation updates registrations without moving user
 * bytes.
 */
export interface ContentDirectoriesApi {
  /**
   * Lists the work's registered roots and saved discovery definitions, including unavailable
   * values.
   */
  list<T extends WorkType>(
    work: EntryRef<T>,
    call?: CallOptions,
  ): Promise<readonly ContentDirectory<T>[]>

  /** Reads one registered root under the work, returning null when it is absent. */
  get<T extends WorkType>(
    work: EntryRef<T>,
    directoryId: string,
    call?: CallOptions,
  ): Promise<ContentDirectory<T> | null>

  /**
   * Registers a local directory with its applicable configuration while preserving user-file
   * locations.
   */
  create(
    ...args: {
      [K in WorkType]: [work: EntryRef<K>, input: DirectoryCreateFields<K>, call?: CallOptions]
    }[WorkType]
  ): Promise<string>

  /**
   * Compares and saves changed discovery settings or profile selection.
   *
   * Existing file associations and their matching modes remain unchanged.
   */
  update(
    work: EntryRef<FileWorkType>,
    directoryId: string,
    input: DirectoryUpdate,
    call?: CallOptions,
  ): Promise<void>

  /**
   * Removes the directory registration while preserving files, launch configurations and user
   * bytes.
   */
  delete(work: WorkRef, directoryId: string, call?: CallOptions): Promise<void>

  /**
   * Verifies selected path mappings and updates stable registrations.
   *
   * Conflicts are reported without moving or merging user files.
   */
  relocate(
    work: WorkRef,
    directoryId: string,
    input: DirectoryRelocationInput,
    call?: CallOptions,
  ): Promise<HoldingsRelocationResult>
}

export const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))

const discoverySchema = v.strictObject({
  maxDepth: v.nullable(positiveInteger),
  include: v.array(v.pipe(v.unknown(), v.transform(parsePathFilter))),
  exclude: v.array(v.pipe(v.unknown(), v.transform(parsePathFilter))),
})

/** Parses the complete depth and path-filter definition for new-file discovery. */
export function parseDirectoryDiscoveryDefinition(input: unknown): DirectoryDiscoveryDefinition {
  return parseValue(discoverySchema, input, 'Invalid directory discovery definition')
}

/**
 * Parses creation fields applicable to the work kind.
 *
 * Game directories reject file-discovery and recognition-profile fields.
 */
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

/** Parses directory-setting changes and expected values for the same complete fields. */
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

/**
 * Parses explicit relocation scope and checks work-specific field applicability.
 *
 * Disk verification and path updates belong to the relocation operation.
 */
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
