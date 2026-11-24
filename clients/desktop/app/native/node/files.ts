import { nativeHostPath } from '#host-path'
import type * as Binding from './binding'

export type FilesystemQueryFailureReason = 'invalidArgument' | `${Binding.FilesystemQueryReason}`

export class FilesystemQueryError extends Error {
  constructor(
    readonly reason: FilesystemQueryFailureReason,
    readonly systemCode: number | undefined,
  ) {
    super('Could not query the filesystem')
    this.name = 'FilesystemQueryError'
  }
}

export type MoveFailureReason =
  | 'targetExists'
  | 'sourceMissing'
  | 'crossDevice'
  | 'unsupported'
  | 'permissionDenied'
  | 'ioFailure'

export type FileSyncFailureReason =
  | 'invalidArgument'
  | 'pathMissing'
  | 'wrongType'
  | 'unsupported'
  | 'permissionDenied'
  | 'ioFailure'

export class FileMoveError extends Error {
  constructor(
    readonly reason: MoveFailureReason,
    readonly systemCode: number | undefined,
  ) {
    super('Could not move the path without replacing the target')
    this.name = 'FileMoveError'
  }
}

export class FileSyncError extends Error {
  constructor(
    readonly reason: FileSyncFailureReason,
    readonly systemCode: number | undefined,
  ) {
    super('Could not synchronize the file')
    this.name = 'FileSyncError'
  }
}

export interface NativeFiles {
  getFilesystemLocation(path: string): Promise<'local' | 'network' | 'unknown'>

  sameDirectoryEntry(first: string, second: string): Promise<boolean>

  moveNoReplace(source: string, target: string): Promise<void>

  syncFile(path: string): Promise<void>
}

function queryPath(input: string): string {
  const path = nativeHostPath(input)
  if (path === undefined) {
    throw new FilesystemQueryError('invalidArgument', undefined)
  }
  return path
}

async function filesystemQuery<T extends string | boolean>(
  query: () => Promise<T | Binding.FilesystemQueryFailure>,
): Promise<T> {
  let result: T | Binding.FilesystemQueryFailure
  try {
    result = await query()
  } catch (cause) {
    if (cause instanceof Error && 'code' in cause && cause.code === 'InvalidArg') {
      throw new FilesystemQueryError('invalidArgument', undefined)
    }
    throw cause
  }
  if (typeof result === 'object') {
    throw new FilesystemQueryError(result.reason, result.systemCode)
  }
  return result
}

export function createNativeFiles(binding: typeof Binding): NativeFiles {
  return {
    getFilesystemLocation(path) {
      return filesystemQuery(() => binding.getFilesystemLocation(queryPath(path)))
    },

    sameDirectoryEntry(first, second) {
      return filesystemQuery(() => binding.sameDirectoryEntry(queryPath(first), queryPath(second)))
    },

    async moveNoReplace(source, target) {
      const from = nativeHostPath(source)
      const to = nativeHostPath(target)
      if (from === undefined || to === undefined) {
        throw new TypeError('Expected fully qualified filesystem paths without NUL')
      }
      const result = await binding.moveNoReplace(from, to)
      if (result.reason) {
        throw new FileMoveError(result.reason as MoveFailureReason, result.systemCode)
      }
    },

    async syncFile(path) {
      const lookup = nativeHostPath(path)
      if (lookup === undefined) {
        throw new FileSyncError('invalidArgument', undefined)
      }
      const result = await binding.syncFile(lookup)
      if (result.reason) {
        throw new FileSyncError(result.reason as FileSyncFailureReason, result.systemCode)
      }
    },
  }
}
