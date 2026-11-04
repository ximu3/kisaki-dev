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

/** Discovery settings control new paths only; they do not remove existing files or choose a naming profile. */
export interface DirectoryDiscoveryDefinition {
  readonly maxDepth: number | null
  readonly include: readonly PathFilter[]
  readonly exclude: readonly PathFilter[]
}

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

export type DirectoryCreateFields<T extends WorkType = WorkType> = {
  [K in T]: { readonly path: string } & (K extends FileWorkType
    ? {
        readonly definition?: DirectoryDiscoveryDefinition
        readonly recognitionProfileId?: string | null
      }
    : object)
}[T]

/** Discovery/profile edits do not relocate paths. A path change with related mappings uses the explicit relocation operation. */
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

/** Only explicitly named stored path fields may accompany directory relocation; commands and historical text are excluded. */
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

export type RelocatedPathTarget =
  | { readonly type: 'directory' | 'file'; readonly id: string }
  | {
      readonly type: 'launchConfig'
      readonly id: string
      readonly field: 'launchPath' | 'workingDirectory' | 'monitorPath' | 'savePath'
    }
  | { readonly type: 'subtitle'; readonly fileId: string; readonly path: string }

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

/** Directory registration owns discovery only; deletion retains files/configurations, and relocation never moves user bytes. */
export interface ContentDirectoriesApi {
  /**
   * Read this work's registered discovery roots and their saved definitions, including
   * explicitly unavailable settings.
   */
  list<T extends WorkType>(
    work: EntryRef<T>,
    call?: CallOptions,
  ): Promise<readonly ContentDirectory<T>[]>

  /**
   * Read one registered root under the supplied work without moving bytes or discovering new
   * files.
   */
  get<T extends WorkType>(
    work: EntryRef<T>,
    directoryId: string,
    call?: CallOptions,
  ): Promise<ContentDirectory<T> | null>

  /**
   * Register a discovery root with its complete media-specific configuration; user files remain
   * in their existing location.
   */
  create(
    ...args: {
      [K in WorkType]: [work: EntryRef<K>, input: DirectoryCreateFields<K>, call?: CallOptions]
    }[WorkType]
  ): Promise<string>

  /**
   * Compare and save changed discovery settings or profile selection; existing file associations
   * and their modes remain unchanged.
   */
  update(
    work: EntryRef<FileWorkType>,
    directoryId: string,
    input: DirectoryUpdate,
    call?: CallOptions,
  ): Promise<void>

  /**
   * Remove only this discovery registration; retain existing files, launch configurations and
   * user bytes.
   */
  delete(work: WorkRef, directoryId: string, call?: CallOptions): Promise<void>

  /**
   * Verify the explicitly selected path mappings and update stable registrations; report
   * conflicts without moving or merging user files.
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
