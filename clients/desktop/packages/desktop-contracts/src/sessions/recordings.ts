import * as v from 'valibot'
import type { CallOptions, Disposable } from '../operations'
import { fromParser, parseValue, id, timestamp, unique } from '../validation'
import { DesktopError, parseErrorSummary, type ErrorSummary } from '../errors'
import { parseWorkRef, type WorkRef } from '../library/catalog'

/** Safe failure summary for one remaining activity or position recording unit. */
export type RecordingIssue =
  | { readonly kind: 'activity'; readonly activityId: string; readonly error: ErrorSummary }
  | { readonly kind: 'position'; readonly error: ErrorSummary }

/**
 * Activity records and positions still waiting to be saved after a session ends, identified by
 * their original work and target.
 */
export type PendingRecording = {
  readonly sessionId: string
  /** UTC milliseconds since the Unix epoch. */
  readonly endedAt: number
  readonly activityIds: readonly string[]
  readonly positionPending: boolean
  readonly issues: readonly RecordingIssue[]
} & (
  | {
      readonly work: WorkRef<'game'>
      readonly target: { readonly launchConfigId: string }
      readonly positionPending: false
    }
  | {
      readonly work: WorkRef<'anime' | 'comic' | 'novel'>
      readonly target: { readonly fileId: string }
    }
)

/** Failed or cancelled retry execution retains both sets in this same result shape. */
export interface RecordingRetryResult {
  readonly sessionId: string

  readonly savedActivityIds: readonly string[]
  readonly positionSaved: boolean

  readonly remainingActivityIds: readonly string[]
  readonly positionPending: boolean
  readonly issues: readonly RecordingIssue[]
}

/** Discarding unsaved recordings requires the user's explicit choice. */
export interface SessionRecordingsApi {
  /**
   * Lists recordings that still need saving, including those from sessions that have ended.
   */
  list(call?: CallOptions): Promise<readonly PendingRecording[]>

  /**
   * Retries saving the pending activity records and file position. Reports what was saved and what
   * remains pending.
   *
   * Retry preserves unresolved work without reopening content or duplicating committed activities.
   */
  retry(sessionId: string, call?: CallOptions): Promise<RecordingRetryResult>

  /**
   * Discards the session's unsaved recordings when the user chooses to do so.
   *
   * Already saved records remain intact.
   */
  discard(sessionId: string, call?: CallOptions): Promise<void>

  /**
   * Subscribe before reading the list. Refreshing it leaves pending recordings available for retry
   * or discard.
   */
  onInvalidated(listener: () => void): Disposable
}

const ids = v.pipe(
  v.array(id),
  v.check((values) => unique(values, (value) => value)),
)

const issue = v.variant('kind', [
  v.strictObject({
    kind: v.literal('activity'),
    activityId: id,
    error: fromParser(parseErrorSummary),
  }),
  v.strictObject({
    kind: v.literal('position'),
    error: fromParser(parseErrorSummary),
  }),
])

function validateRecordingIssues(
  activityIds: readonly string[],
  positionPending: boolean,
  issues: readonly RecordingIssue[],
): void {
  if (
    !unique(issues, (value) =>
      value.kind === 'position' ? 'position' : `activity:${value.activityId}`,
    ) ||
    issues.some((value) =>
      value.kind === 'position' ? !positionPending : !activityIds.includes(value.activityId),
    )
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Recording issues must describe distinct remaining units',
    )
  }
}

/**
 * Parses an ended session's pending-recording summary and checks its target, remaining units and
 * issues.
 */
export function parsePendingRecording(input: unknown): PendingRecording {
  const value = parseValue(
    v.strictObject({
      sessionId: id,
      endedAt: timestamp,
      activityIds: ids,
      positionPending: v.boolean(),
      issues: v.array(issue),
      work: fromParser(parseWorkRef),
      target: v.union([v.strictObject({ launchConfigId: id }), v.strictObject({ fileId: id })]),
    }),
    input,
    'Invalid pending recording',
  )
  if (
    (value.work.type === 'game') !== 'launchConfigId' in value.target ||
    (value.work.type === 'game' && value.positionPending) ||
    (value.activityIds.length === 0 && !value.positionPending)
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Pending recording target or remaining units are inconsistent',
    )
  }
  validateRecordingIssues(value.activityIds, value.positionPending, value.issues)
  return value as PendingRecording
}

/** An idempotent retry of an ended recording can return an empty receipt. */
export function parseRecordingRetryResult(input: unknown): RecordingRetryResult {
  const value = parseValue(
    v.strictObject({
      sessionId: id,
      savedActivityIds: ids,
      positionSaved: v.boolean(),
      remainingActivityIds: ids,
      positionPending: v.boolean(),
      issues: v.array(issue),
    }),
    input,
    'Invalid recording retry result',
  )
  if (
    value.savedActivityIds.some((key) => value.remainingActivityIds.includes(key)) ||
    (value.positionSaved && value.positionPending)
  ) {
    throw new DesktopError('InvalidInput', 'Committed recording units cannot remain pending')
  }
  validateRecordingIssues(value.remainingActivityIds, value.positionPending, value.issues)
  return value
}
