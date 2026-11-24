import * as v from 'valibot'
import type { CallOptions, Disposable } from '../operations'
import { fromParser, parseValue, id, timestamp, unique } from '../validation'
import { DesktopError, parseErrorSummary, type ErrorSummary } from '../errors'
import { parseWorkRef, type WorkRef } from '../library/catalog'

export type RecordingIssue =
  | { readonly kind: 'activity'; readonly activityId: string; readonly error: ErrorSummary }
  | { readonly kind: 'position'; readonly error: ErrorSummary }

export type PendingRecording = {
  readonly sessionId: string
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

export interface RecordingRetryResult {
  readonly sessionId: string

  readonly savedActivityIds: readonly string[]
  readonly positionSaved: boolean

  readonly remainingActivityIds: readonly string[]
  readonly positionPending: boolean
  readonly issues: readonly RecordingIssue[]
}

export interface SessionRecordingsApi {
  list(call?: CallOptions): Promise<readonly PendingRecording[]>

  retry(sessionId: string, call?: CallOptions): Promise<RecordingRetryResult>

  discard(sessionId: string, call?: CallOptions): Promise<void>

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
