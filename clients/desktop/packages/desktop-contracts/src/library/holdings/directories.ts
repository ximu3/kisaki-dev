import type { WorkType, EntryRef, WorkRef, FileWorkType } from '../catalog'

import type { StoredDefinition, NonEmptyArray, CallOptions } from '../../operations'
import * as v from 'valibot'
import { parseAbsolutePath, parsePathFilter, type PathFilter } from '../../paths'
import {
  fromParser,
  positiveInteger,
  parseValue,
  id,
  optionalFields,
  validateExpectedKeys,
  unique,
} from '../../validation'
import { DesktopError, type ErrorSummary } from '../../errors'

/**
 * Changes govern discovery of new files. Existing registrations and naming-profile selection are
 * separate.
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

/** A null recognitionProfileId selects built-in recognition only. */
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
 * Relocation covers only explicitly selected path mappings. Commands and historical text retain
 * their original spelling.
 */
export type DirectoryRelocationInput<T extends WorkType = WorkType> = {
  [K in T]: {
    readonly path: string
    readonly expected?: { readonly path: string }

    readonly gameConfigFields?: K extends 'game'
      ? readonly {
          readonly launchConfigId: string
          readonly fields: NonEmptyArray<
            'launchPath' | 'workingDirectory' | 'monitorPath' | 'savePath'
          >
        }[]
      : never

    readonly subtitlePaths?: K extends 'anime'
      ? readonly { readonly fileId: string; readonly paths: NonEmptyArray<string> }[]
      : never
  }
}[T]

export type RelocatedPathTarget<T extends WorkType = WorkType> =
  | { readonly type: 'directory'; readonly id: string }
  | (T extends FileWorkType ? { readonly type: 'file'; readonly id: string } : never)
  | (T extends 'game'
      ? {
          readonly type: 'launchConfig'
          readonly id: string
          readonly field: 'launchPath' | 'workingDirectory' | 'monitorPath' | 'savePath'
        }
      : never)
  | (T extends 'anime'
      ? { readonly type: 'subtitle'; readonly fileId: string; readonly path: string }
      : never)

export type HoldingsRelocationResult<T extends WorkType = WorkType> = {
  [K in T]: {
    readonly work: WorkRef<K>

    readonly updated: readonly {
      readonly target: RelocatedPathTarget<K>
      readonly from: string
      readonly to: string
    }[]

    readonly issues: readonly {
      readonly target: RelocatedPathTarget<K>
      readonly path: string
      readonly status: 'unverified' | 'unavailable' | 'conflict'
      readonly error: ErrorSummary
    }[]
  }
}[T]

/**
 * Deleting a directory registration preserves files and configurations. Relocation updates
 * registrations while keeping user bytes in place.
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

  create(
    ...args: {
      [K in WorkType]: [work: EntryRef<K>, input: DirectoryCreateFields<K>, call?: CallOptions]
    }[WorkType]
  ): Promise<string>

  /**
   * Changing discovery settings or the profile leaves existing associations and matching modes
   * unchanged.
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
   * Verifies selected mappings before updating registrations. Reported conflicts leave user files
   * in place.
   */
  relocate<
    Args extends {
      [K in WorkType]: [
        work: WorkRef<K>,
        directoryId: string,
        input: DirectoryRelocationInput<K>,
        call?: CallOptions,
      ]
    }[WorkType],
  >(
    ...args: Args
  ): Promise<HoldingsRelocationResult<Args[0]['type']>>
}

export const path = fromParser(parseAbsolutePath)

const discoverySchema = v.strictObject({
  maxDepth: v.nullable(positiveInteger),
  include: v.array(fromParser(parsePathFilter)),
  exclude: v.array(fromParser(parsePathFilter)),
})

export function parseDirectoryDiscoveryDefinition(input: unknown): DirectoryDiscoveryDefinition {
  return parseValue(discoverySchema, input, 'Invalid directory discovery definition')
}

/** Game directories reject discovery and recognition-profile fields. */
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

/** Disk verification and path updates belong to the relocation operation. */
export function parseDirectoryRelocationInput<T extends WorkType>(
  workType: T,
  input: unknown,
): DirectoryRelocationInput<T>

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

  return value as DirectoryRelocationInput
}
