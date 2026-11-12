/** @fileoverview Defines native application information, actual system integration and coordinated exit without process/window handles. */

import type { ErrorSummary } from './errors'
import type { CallOptions, Listener, Disposable } from './operations'
import type { WorkType, WorkRef } from './library/catalog'
import * as v from 'valibot'
import { parseAbsolutePath } from './paths'
import { parseErrorSummary, DesktopError } from './errors'
import {
  parseValue,
  parseExternalValue,
  nonemptyText,
  id,
  unique,
  nonnegativeInteger,
} from './validation'
import { parseVersion } from '@kisaki3/extension-distribution/compatibility'
import { parseWorkRef } from './library/catalog'

export const applicationIdentities = Object.freeze({
  production: { appId: 'me.kisaki', scheme: 'kisaki' },
  development: { appId: 'me.kisaki.dev', scheme: 'kisaki-dev' },
} as const)

/**
 * Shareable version, operating system and process architecture.
 *
 * Architecture describes the running application, rather than physical hardware. The snapshot
 * excludes private paths and accounts.
 */
export interface ApplicationEnvironment {
  readonly version: string
  readonly operatingSystem: { readonly name: string; readonly version: string }
  readonly architecture: 'x64' | 'arm64'
}

/** The application-managed normal or portable data-root selection. */
export type DataMode = 'normal' | 'portable'

/**
 * Current data-root facts and the portable mode available for the next launch.
 *
 * The current root is fixed for this process. Changing nextMode leaves both directories and their
 * contents in place.
 */
export interface DataLocationState {
  readonly current: { readonly mode: DataMode; readonly path: string }
  readonly normalPath: string
  readonly portable:
    | { readonly status: 'unsupported' }
    | { readonly status: 'available'; readonly path: string; readonly nextMode: DataMode }
    | { readonly status: 'unavailable'; readonly error: ErrorSummary }
}

/** A next-launch mode change with explicit intent to use an existing or empty target root. */
export interface DataModeChange {
  readonly mode: DataMode
  readonly target: 'existing' | 'empty'
}

/**
 * Actual login-item registration and the separate operating-system permission state.
 *
 * Unsupported operations and failed reads have explicit states.
 */
export type LoginItemState =
  | {
      readonly status: 'available'
      readonly registered: boolean
      readonly permission: 'allowed' | 'requiresApproval' | 'denied' | 'notApplicable'
      readonly settingsAvailable: boolean
    }
  | { readonly status: 'unsupported' }
  | { readonly status: 'unavailable'; readonly error: ErrorSummary }

/**
 * Actual registration and default-handler status for this application's scheme.
 *
 * A null isDefault means the platform cannot establish which application owns the association.
 */
export type ProtocolIntegrationState =
  | {
      readonly status: 'available'
      readonly scheme: 'kisaki' | 'kisaki-dev'
      readonly registered: boolean
      readonly isDefault: boolean | null
      readonly settingsAvailable: boolean
    }
  | { readonly status: 'unavailable'; readonly error: ErrorSummary }

/**
 * Desktop-entry registration, its read failure, or a platform where registration does not apply.
 */
export type DesktopEntryState =
  | { readonly status: 'notApplicable' }
  | { readonly status: 'available'; readonly registered: boolean }
  | { readonly status: 'unavailable'; readonly error: ErrorSummary }

/** Operating-system integration and data-location facts for the running application. */
export interface SystemIntegrationState {
  readonly loginItem: LoginItemState
  readonly protocol: ProtocolIntegrationState
  readonly desktopEntry: DesktopEntryState
  readonly dataLocation: DataLocationState
}

/** Reads and changes actual system registration and next-launch data selection. */
export interface SystemIntegrationApi {
  /**
   * Reads actual operating-system integration and data-location facts.
   *
   * Unsupported operations and failed reads remain explicit states.
   */
  getState(call?: CallOptions): Promise<SystemIntegrationState>

  /** Applies login-item registration and returns the reread operating-system state. */
  setLoginItem(enabled: boolean, call?: CallOptions): Promise<LoginItemState>

  /**
   * Requests registration of this application's scheme and rereads its actual association.
   *
   * Operating-system approval remains separate from registration.
   */
  registerProtocol(call?: CallOptions): Promise<ProtocolIntegrationState>

  /**
   * Registers supported desktop integration and returns its actual state.
   *
   * Platforms without this integration return notApplicable.
   */
  registerDesktopEntry(call?: CallOptions): Promise<DesktopEntryState>

  /**
   * Opens the available operating-system settings for the requested integration.
   *
   * Opening settings leaves permissions and preferences under their existing owners.
   */
  openSettings(target: 'loginItem' | 'protocol', call?: CallOptions): Promise<void>

  /**
   * Prepares the chosen existing or empty root for the next launch.
   *
   * The current root and its data remain in place.
   */
  setDataMode(input: DataModeChange, call?: CallOptions): Promise<DataLocationState>
}

/**
 * Exit progress for one actual content session and its type-specific target.
 *
 * Only game sessions can detach. A failure identifies the close, save or release stage that failed.
 */
export type SessionExitProgress = {
  [K in WorkType]: {
    readonly sessionId: string
    readonly work: WorkRef<K>
    readonly target: K extends 'game'
      ? { readonly launchConfigId: string }
      : { readonly fileId: string }
    readonly state:
      | { readonly phase: 'closing' | 'saving' | 'releasing' | 'ended' }
      | (K extends 'game' ? { readonly phase: 'detached' } : never)
      | {
          readonly phase: 'failed'
          readonly stage: 'closing' | 'saving' | 'releasing'
          readonly error: ErrorSummary
        }
  }
}[WorkType]

/**
 * The exit coordinator's intent and progress across sessions and pending recordings.
 *
 * The coordinator includes accepted preparation work before a TaskRun exists; task counts alone
 * cannot establish readiness.
 */
export type ApplicationExitState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'closing' | 'waiting' | 'failed' | 'exiting'
      readonly intent: 'quit' | 'restart' | 'installUpdate'
      readonly sessions: readonly SessionExitProgress[]
      readonly pendingRecordings: number
      readonly error: ErrorSummary | null
    }

/** The outcome of an exit attempt, including cancellation or a reported failure. */
export type ApplicationExitResult =
  | { readonly outcome: 'exiting' | 'cancelled' }
  | { readonly outcome: 'failed'; readonly error: ErrorSummary }

/** Coordinates application exit with accepted content, recording and resource cleanup. */
export interface ApplicationExitApi {
  /** Reads exit progress, including accepted work that has not yet created a task record. */
  getState(call?: CallOptions): Promise<ApplicationExitState>

  /**
   * Delivers the current exit state and subsequent changes.
   *
   * Disposal releases observation while the exit operation continues.
   */
  observe(listener: Listener<ApplicationExitState>): Disposable

  /**
   * Waits for content, recording and resource cleanup before exit.
   *
   * Ordinary closure does not escalate to forced termination.
   */
  quit(call?: CallOptions): Promise<ApplicationExitResult>

  /**
   * Runs the same close, recording and release sequence as quit before restarting.
   *
   * Cancellation preserves completed work.
   */
  restart(call?: CallOptions): Promise<ApplicationExitResult>

  /** Resumes normal acceptance while preserving ended content and saved facts. */
  cancel(call?: CallOptions): Promise<void>

  /** Continues waiting for accepted close work without sending another round of exit requests. */
  continueWaiting(call?: CallOptions): Promise<ApplicationExitResult>
}

/** Application environment, system integration and coordinated exit capabilities. */
export interface AppApi {
  readonly systemIntegration: SystemIntegrationApi
  readonly exit: ApplicationExitApi

  /** Reads a shareable version, operating-system and process-architecture snapshot. */
  getEnvironment(call?: CallOptions): Promise<ApplicationEnvironment>

  /**
   * Copies the safe environment summary to the clipboard on the user's request.
   *
   * Resolves after the copy succeeds; the action does not upload the summary.
   */
  copyEnvironment(call?: CallOptions): Promise<void>
}

const mode = v.picklist(['normal', 'portable'])

const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))

const error = v.pipe(v.unknown(), v.transform(parseErrorSummary))

/**
 * Parses the application's release version and rejects SemVer build metadata.
 *
 * Build identity is carried separately from the release version.
 */
export function parseApplicationVersion(input: unknown): string {
  const version = parseExternalValue(parseVersion, input, 'Invalid application version')
  if (version.includes('+')) {
    throw new DesktopError('InvalidInput', 'Application versions cannot contain build metadata')
  }

  return version
}

/** Parses the shareable environment fields and rejects extra diagnostic fields. */
export function parseApplicationEnvironment(input: unknown): ApplicationEnvironment {
  return parseValue(
    v.strictObject({
      version: v.pipe(v.unknown(), v.transform(parseApplicationVersion)),
      operatingSystem: v.strictObject({ name: nonemptyText, version: nonemptyText }),
      architecture: v.picklist(['x64', 'arm64']),
    }),
    input,
    'Invalid application environment',
  )
}

/**
 * Parses current and next-launch data-location facts, preserving unavailable marker-read states.
 */
export function parseDataLocationState(input: unknown): DataLocationState {
  return parseValue(
    v.strictObject({
      current: v.strictObject({ mode, path }),
      normalPath: path,
      portable: v.variant('status', [
        v.strictObject({ status: v.literal('unsupported') }),
        v.strictObject({ status: v.literal('available'), path, nextMode: mode }),
        v.strictObject({ status: v.literal('unavailable'), error }),
      ]),
    }),
    input,
    'Invalid data location state',
  )
}

/** Parses the next-launch mode and explicit existing-or-empty target intent. */
export function parseDataModeChange(input: unknown): DataModeChange {
  return parseValue(
    v.strictObject({ mode, target: v.picklist(['existing', 'empty']) }),
    input,
    'Invalid data mode selection',
  )
}

/** Parses session exit progress and checks that its target and phase match the work type. */
export function parseSessionExitProgress(input: unknown): SessionExitProgress {
  const value = parseValue(
    v.strictObject({
      sessionId: id,
      work: v.pipe(v.unknown(), v.transform(parseWorkRef)),
      target: v.union([v.strictObject({ launchConfigId: id }), v.strictObject({ fileId: id })]),
      state: v.variant('phase', [
        v.strictObject({
          phase: v.picklist(['closing', 'saving', 'releasing', 'ended', 'detached']),
        }),
        v.strictObject({
          phase: v.literal('failed'),
          stage: v.picklist(['closing', 'saving', 'releasing']),
          error,
        }),
      ]),
    }),
    input,
    'Invalid session exit progress',
  )
  if (
    (value.work.type === 'game') !== 'launchConfigId' in value.target ||
    (value.state.phase === 'detached' && value.work.type !== 'game')
  ) {
    throw new DesktopError('InvalidInput', 'Exit target does not match its work type')
  }

  return value as SessionExitProgress
}

/** Parses exit progress with distinct session identities and a nonnegative recording count. */
export function parseApplicationExitState(input: unknown): ApplicationExitState {
  return parseValue(
    v.variant('status', [
      v.strictObject({ status: v.literal('idle') }),
      v.strictObject({
        status: v.picklist(['closing', 'waiting', 'failed', 'exiting']),
        intent: v.picklist(['quit', 'restart', 'installUpdate']),
        sessions: v.pipe(
          v.array(v.pipe(v.unknown(), v.transform(parseSessionExitProgress))),
          v.check((values) => unique(values, (value) => value.sessionId)),
        ),
        pendingRecordings: nonnegativeInteger,
        error: v.nullable(error),
      }),
    ]),
    input,
    'Invalid application exit state',
  )
}
