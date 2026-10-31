/**
 * @fileoverview Defines serializable error summaries and partial execution results for
 * cross-boundary failures.
 */

import * as v from 'valibot'
import { objectSchema } from './schema'

/** The desktop failure vocabulary. Unknown safe codes remain readable across API versions. */
export const desktopErrorCodes = [
  'InvalidInput',
  'NotFound',
  'InvalidReference',
  'Conflict',
  'TargetChanged',
  'InUse',
  'Busy',
  'ResourceLimit',
  'PermissionDenied',
  'Cancelled',
  'ConnectionClosed',
  'InstanceExpired',
  'DataIntegrityError',
  'ReadFailed',
  'WriteFailed',
  'OperationFailed',
  'InvalidQuery',
  'SelectionChanged',
  'UnsupportedMembershipMode',
  'FileUnavailable',
  'PathUnresolved',
  'PathConflict',
  'GameLaunchUnconfirmed',
  'RecordingSaveFailed',
  'PendingRecording',
  'PositionSuperseded',
  'PlaybackApplyFailed',
  'CaptureUnavailable',
  'UnsupportedBackupFormat',
  'RecoveryUnverifiable',
  'RecoveryCommitFailed',
  'AlreadyResolved',
  'CredentialProtectionUnavailable',
  'CredentialUnreadable',
  'ProtocolMismatch',
  'ApiIncompatible',
  'ProtocolViolation',
  'PayloadTooLarge',
] as const

/** A code owned by the desktop contract; extension-private failures can use other safe codes. */
export type DesktopErrorCode = (typeof desktopErrorCodes)[number]

/** A safe, serializable failure description; callers classify by code, never by message. */
export interface ErrorSummary {
  readonly code: string
  readonly message: string
}

/** A failed invocation may retain the result already established by that operation. */
export interface ExecutionFailure<Result> extends ErrorSummary {
  readonly partialResult?: Result
}

const summaryEntries = { code: v.pipe(v.string(), v.nonEmpty()), message: v.string() }
const summarySchema = objectSchema(summaryEntries)

/** A recognizable rejected invocation. A partial result is an actual legal result, not a draft. */
export class ExecutionError<Result = never> extends Error implements ExecutionFailure<Result> {
  override readonly name = 'ExecutionError'
  readonly code: string
  readonly partialResult?: Result

  constructor(failure: ExecutionFailure<Result>, options?: ErrorOptions) {
    super(failure.message, options)
    this.code = failure.code
    if ('partialResult' in failure) {
      this.partialResult = failure.partialResult
    }
  }
}

/** Parse a safe summary, preserving unfamiliar codes but rejecting hidden or extra fields. */
export function parseErrorSummary(input: unknown): ErrorSummary {
  const result = v.safeParse(summarySchema, input)
  if (!result.success) {
    throw new ExecutionError({ code: 'InvalidInput', message: 'Invalid error summary.' })
  }
  return result.output
}

/** Validate the complete failure, delegating partial-result semantics to its operation. */
export function parseExecutionFailure<Result>(
  input: unknown,
  parseResult: (value: unknown) => Result,
): ExecutionFailure<Result> {
  const result = v.safeParse(
    objectSchema({ ...summaryEntries, partialResult: v.exactOptional(v.unknown()) }),
    input,
  )
  if (!result.success) {
    throw new ExecutionError({ code: 'InvalidInput', message: 'Invalid execution failure.' })
  }
  const { code, message } = result.output
  if (Object.hasOwn(result.output, 'partialResult')) {
    if (result.output.partialResult === undefined) {
      throw new ExecutionError({
        code: 'InvalidInput',
        message: 'An explicit partial result cannot be undefined.',
      })
    }
    return { code, message, partialResult: parseResult(result.output.partialResult) }
  }
  return { code, message }
}

/** Create a safe classified input failure; rejected input is never copied into the message. */
export function invalidInput(message: string): never {
  throw new ExecutionError({ code: 'InvalidInput', message })
}
