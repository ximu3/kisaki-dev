/**
 * @fileoverview Converts native file completions and argument failures into the application's
 * typed file errors.
 */

import type * as Binding from './binding'

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
  'invalidArgument' | 'pathMissing' | 'wrongType' | 'unsupported' | 'permissionDenied' | 'ioFailure'

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

/**
 * Creates application-facing file operations from the supplied native binding.
 *
 * The binding validates platform paths before queueing work. This adapter converts argument and
 * completion failures to the declared Node error types.
 */
export function createNativeFiles(binding: typeof Binding): NativeFiles {
  return {
    /**
     * Implements {@link NativeFiles.moveNoReplace} by translating native completions and argument
     * errors.
     */
    async moveNoReplace(source, target) {
      try {
        const result = await binding.moveNoReplace(source, target)
        if (result.reason) {
          throw new FileMoveError(
            result.reason as MoveFailureReason,
            result.systemCode ?? undefined,
          )
        }
      } catch (cause) {
        if (cause instanceof Error && 'code' in cause && cause.code === 'InvalidArg') {
          throw new TypeError('Expected absolute paths without NUL', { cause })
        }
        throw cause
      }
    },

    /**
     * Implements {@link NativeFiles.syncFile} by translating native completions and argument
     * errors.
     */
    async syncFile(path) {
      try {
        const result = await binding.syncFile(path)
        if (result.reason) {
          throw new FileSyncError(
            result.reason as FileSyncFailureReason,
            result.systemCode ?? undefined,
          )
        }
      } catch (cause) {
        if (cause instanceof Error && 'code' in cause && cause.code === 'InvalidArg') {
          throw new FileSyncError('invalidArgument', undefined)
        }
        throw cause
      }
    },
  }
}
