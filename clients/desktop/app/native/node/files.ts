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

/** A failed move retains its platform code; consumers branch on reason. */
export class FileMoveError extends Error {
  constructor(
    readonly reason: MoveFailureReason,
    readonly systemCode: number | undefined,
  ) {
    super('Could not move the path without replacing the target')
    this.name = 'FileMoveError'
  }
}

/** A failed file synchronization, with the platform code available for diagnostics. */
export class FileSyncError extends Error {
  constructor(
    readonly reason: FileSyncFailureReason,
    readonly systemCode: number | undefined,
  ) {
    super('Could not synchronize the file')
    this.name = 'FileSyncError'
  }
}

/** File primitives owned by the native module; application policy remains with the caller. */
export interface NativeFiles {
  /**
   * Move on a worker and resolve after the same-filesystem, no-replace operation succeeds.
   * Invalid arguments reject with TypeError; platform failures reject with FileMoveError.
   */
  moveNoReplace(source: string, target: string): Promise<void>

  /**
   * Flush one existing regular file on a worker and close its handle before resolving.
   * Invalid arguments and platform failures reject with FileSyncError.
   */
  syncFile(path: string): Promise<void>
}

/** Adapt errors from the native boundary, which validates platform paths before scheduling work. */
export function createNativeFiles(binding: typeof Binding): NativeFiles {
  return {
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
