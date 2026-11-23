import { nativeHostPath } from '#host-path'
import type * as Binding from './binding'

/** Reasons for a failed filesystem observation, including arguments rejected before lookup. */
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

/**
 * Application-facing file primitives implemented by the private native module.
 *
 * Paths follow native platform rules; Windows drive-rooted paths without a drive prefix are rejected.
 */
export interface NativeFiles {
  /** Reads an existing path's mount classification on a worker. Failures reject with FilesystemQueryError. */
  getFilesystemLocation(path: string): Promise<'local' | 'network' | 'unknown'>

  /** Compares Windows volume roots or entries in an established common parent, preserving each final link. */
  sameDirectoryEntry(first: string, second: string): Promise<boolean>

  /**
   * Moves an absolute source to an absent target within the same filesystem.
   *
   * Runs on a worker and resolves after the atomic operation succeeds. Invalid arguments reject
   * with TypeError; platform failures reject with FileMoveError.
   */
  moveNoReplace(source: string, target: string): Promise<void>

  /**
   * Synchronizes an existing regular file and closes its native handle before resolving.
   *
   * Runs on a worker. Argument and platform failures reject with FileSyncError; parent-directory
   * synchronization belongs to the caller.
   */
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
