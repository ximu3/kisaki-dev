/**
 * @fileoverview Converts native file completions and argument failures into the application's
 * typed file errors.
 */

import { nativeHostPath } from '#host-path'
import type * as Binding from './binding'

/** Reasons for a failed filesystem observation, including arguments rejected before lookup. */
export type FilesystemQueryFailureReason = 'invalidArgument' | `${Binding.FilesystemQueryReason}`

/** A volume or directory-entry lookup that could not deliver an observation. */
export class FilesystemQueryError extends Error {
  /** Preserves the classified cause and the OS code supplied by the filesystem. */
  constructor(
    readonly reason: FilesystemQueryFailureReason,
    readonly systemCode: number | undefined,
  ) {
    super('Could not query the filesystem')
    this.name = 'FilesystemQueryError'
  }
}

/** Failure reasons returned by the platform's atomic move operation. */
export type MoveFailureReason =
  | 'targetExists'
  | 'sourceMissing'
  | 'crossDevice'
  | 'unsupported'
  | 'permissionDenied'
  | 'ioFailure'

/** Stable failures from synchronizing one existing regular file. */
export type FileSyncFailureReason =
  | 'invalidArgument'
  | 'pathMissing'
  | 'wrongType'
  | 'unsupported'
  | 'permissionDenied'
  | 'ioFailure'

/** A failed non-replacing move with a stable reason and optional platform error code. */
export class FileMoveError extends Error {
  /** Records the move classification and preserves the platform code for diagnostics. */
  constructor(
    readonly reason: MoveFailureReason,
    readonly systemCode: number | undefined,
  ) {
    super('Could not move the path without replacing the target')
    this.name = 'FileMoveError'
  }
}

/** A failed file synchronization with a stable reason and optional platform error code. */
export class FileSyncError extends Error {
  /** Records the synchronization classification and optional platform code. */
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

/** Selects the native lookup spelling or rejects an invalid metadata query. */
function queryPath(input: string): string {
  const path = nativeHostPath(input)
  if (path === undefined) {
    throw new FilesystemQueryError('invalidArgument', undefined)
  }
  return path
}

/** Delivers a native observation or a typed rejection for its argument or lookup failure. */
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

/**
 * Creates application-facing file operations from the supplied native binding.
 *
 * Each operation passes its fully qualified lookup paths to the binding and delivers its
 * argument and completion failures through the declared Node error types.
 */
export function createNativeFiles(binding: typeof Binding): NativeFiles {
  return {
    /** Returns the native observation of the existing path's backing filesystem. */
    getFilesystemLocation(path) {
      return filesystemQuery(() => binding.getFilesystemLocation(queryPath(path)))
    },

    /** Looks up both entries through the access paths selected by the caller. */
    sameDirectoryEntry(first, second) {
      return filesystemQuery(() => binding.sameDirectoryEntry(queryPath(first), queryPath(second)))
    },

    /**
     * Implements {@link NativeFiles.moveNoReplace} by translating native completions and argument
     * errors.
     */
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

    /**
     * Implements {@link NativeFiles.syncFile} by translating native completions and argument
     * errors.
     */
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
