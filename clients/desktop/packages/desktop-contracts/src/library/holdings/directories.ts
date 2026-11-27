import type { WorkType, EntryRef, WorkRef, FileWorkType } from '../catalog'

import type { StoredValue, NonEmptyArray, CallOptions } from '../../operations'
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
    readonly createdAt: number
    readonly updatedAt: number
  } & (K extends FileWorkType
    ? {
        readonly definition: StoredValue<DirectoryDiscoveryDefinition>
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

export interface ContentDirectoriesApi {
  list<T extends WorkType>(
    work: EntryRef<T>,
    call?: CallOptions,
  ): Promise<readonly ContentDirectory<T>[]>

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

  update(
    work: EntryRef<FileWorkType>,
    directoryId: string,
    input: DirectoryUpdate,
    call?: CallOptions,
  ): Promise<void>

  delete(work: WorkRef, directoryId: string, call?: CallOptions): Promise<void>

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
