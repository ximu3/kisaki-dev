/** @fileoverview Defines safe desktop failures without serializing implementation exceptions. */

/** Stable desktop failure categories; unknown extension codes remain valid transport values. */
export const desktopErrorCodes = Object.freeze([
  'InvalidInput',
  'InteractionRequired',
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
] as const)

/** Classification owned by desktop operations, independent of error message wording. */
export type DesktopErrorCode = (typeof desktopErrorCodes)[number]

/** A safe explanation suitable for history, observation and fact events. */
export interface ErrorSummary {
  readonly code: string
  readonly message: string
}

/** A failed call can retain a complete, legal business result, never a Partial<Result>. */
export interface ExecutionFailure<Result> extends ErrorSummary {
  readonly partialResult?: Result
}

/**
 * A recognizable local error. Only code, message and a validated partialResult cross a boundary.
 * The owning operation supplies safe English text; cause stays local and does not authorize retries.
 */
export class DesktopError<Result = never> extends Error implements ExecutionFailure<Result> {
  readonly code: string
  readonly partialResult?: Result

  constructor(
    code: string,
    message: string,
    options?: { cause?: unknown; partialResult?: Result },
  ) {
    super(message, options)
    this.name = 'DesktopError'
    this.code = code
    if (options && Object.hasOwn(options, 'partialResult')) {
      this.partialResult = options.partialResult!
    }
  }
}

/** Read an exact safe error summary; unknown codes are preserved rather than reclassified. */
export function parseErrorSummary(input: unknown): ErrorSummary {
  const value = errorRecord(input, ['code', 'message'])
  return { code: value.code, message: value.message }
}

/**
 * Read a call failure with the operation's own result parser. Present partial results must be valid,
 * including when the code is unknown. A malformed result rejects the failure instead of dropping facts.
 */
export function parseExecutionFailure<Result>(
  input: unknown,
  parseResult: (input: unknown) => Result,
): ExecutionFailure<Result> {
  const value = errorRecord(input, ['code', 'message', 'partialResult'])
  if (Object.hasOwn(value, 'partialResult')) {
    return {
      code: value.code,
      message: value.message,
      partialResult: parseResult(value.partialResult),
    }
  }
  return { code: value.code, message: value.message }
}

function errorRecord(
  input: unknown,
  keys: readonly string[],
): ErrorSummary & Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new DesktopError('InvalidInput', 'Expected a safe error object')
  }
  const value = input as Record<string, unknown>
  if (
    Object.keys(value).some((key) => !keys.includes(key)) ||
    typeof value.code !== 'string' ||
    value.code.length === 0 ||
    typeof value.message !== 'string' ||
    value.message.length === 0
  ) {
    throw new DesktopError('InvalidInput', 'Invalid safe error fields')
  }
  return { ...value, code: value.code, message: value.message }
}
