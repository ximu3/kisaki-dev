/**
 * @fileoverview Adapts native file operations to absolute-path inputs and typed errors at
 * the Node boundary.
 */

import { isAbsolute } from 'node:path'
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
  /** Move on a worker; resolve only after the same-filesystem, no-replace operation succeeds. */
  moveNoReplace(source: string, target: string): Promise<void>
  /** Flush one existing regular file on a worker and close its handle before resolving. */
  syncFile(path: string): Promise<void>
}

function validPath(path: string): boolean {
  return isAbsolute(path) && !path.includes('\0')
}

/** Bind generated native declarations to the application's stable structured errors. */
export function createNativeFiles(binding: typeof Binding): NativeFiles {
  return {
    async moveNoReplace(source, target) {
      if (!validPath(source) || !validPath(target)) {
        throw new TypeError('Expected absolute paths without NUL')
      }

      const result = await binding.moveNoReplace(source, target)
      if (result.reason) {
        throw new FileMoveError(result.reason as MoveFailureReason, result.systemCode ?? undefined)
      }
    },
    async syncFile(path) {
      if (!validPath(path)) {
        throw new FileSyncError('invalidArgument', undefined)
      }

      const result = await binding.syncFile(path)
      if (result.reason) {
        throw new FileSyncError(
          result.reason as FileSyncFailureReason,
          result.systemCode ?? undefined,
        )
      }
    },
  }
}
