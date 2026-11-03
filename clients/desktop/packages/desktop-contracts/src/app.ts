/** @fileoverview Defines native application information, actual system integration and coordinated exit without process/window handles. */

import * as v from 'valibot'
import { parseVersion } from '@kisaki3/extension-distribution/compatibility'
import { DesktopError, parseErrorSummary } from './errors'
import type { ErrorSummary } from './errors'
import { parseWorkRef } from './library/catalog'
import type { WorkRef, WorkType } from './library/catalog'
import type { CallOptions, Disposable, Listener } from './operations'
import { parseAbsolutePath } from './paths'
import {
  id,
  nonemptyText,
  nonnegativeInteger,
  parseExternalValue,
  parseValue,
  unique,
} from './validation'

export const applicationIdentities = Object.freeze({
  production: { appId: 'me.kisaki', scheme: 'kisaki' },
  development: { appId: 'me.kisaki.dev', scheme: 'kisaki-dev' },
} as const)
/** The running application's architecture, not physical hardware architecture. Environment sharing excludes private paths and accounts. */
export interface ApplicationEnvironment {
  readonly version: string
  readonly operatingSystem: { readonly name: string; readonly version: string }
  readonly architecture: 'x64' | 'arm64'
}
export type DataMode = 'normal' | 'portable'
/** Current root is fixed for this process. A changed nextMode never moves or merges either data directory. */
export interface DataLocationState {
  readonly current: { readonly mode: DataMode; readonly path: string }
  readonly normalPath: string
  readonly portable:
    | { readonly status: 'unsupported' }
    | { readonly status: 'available'; readonly path: string; readonly nextMode: DataMode }
    | { readonly status: 'unavailable'; readonly error: ErrorSummary }
}
/** Mode selection uses an explicitly existing or newly prepared empty target; no arbitrary third data path is accepted. */
export interface DataModeChange {
  readonly mode: DataMode
  readonly target: 'existing' | 'empty'
}
/** Registration and OS permission are separate facts. A failed/unsupported read is never projected as disabled. */
export type LoginItemState =
  | {
      readonly status: 'available'
      readonly registered: boolean
      readonly permission: 'allowed' | 'requiresApproval' | 'denied' | 'notApplicable'
      readonly settingsAvailable: boolean
    }
  | { readonly status: 'unsupported' }
  | { readonly status: 'unavailable'; readonly error: ErrorSummary }
/** isDefault=null means the platform cannot establish the association; it does not mean this app owns it. */
export type ProtocolIntegrationState =
  | {
      readonly status: 'available'
      readonly scheme: 'kisaki' | 'kisaki-dev'
      readonly registered: boolean
      readonly isDefault: boolean | null
      readonly settingsAvailable: boolean
    }
  | { readonly status: 'unavailable'; readonly error: ErrorSummary }
export type DesktopEntryState =
  | { readonly status: 'notApplicable' }
  | { readonly status: 'available'; readonly registered: boolean }
  | { readonly status: 'unavailable'; readonly error: ErrorSummary }
export interface SystemIntegrationState {
  readonly loginItem: LoginItemState
  readonly protocol: ProtocolIntegrationState
  readonly desktopEntry: DesktopEntryState
  readonly dataLocation: DataLocationState
}
export interface SystemIntegrationApi {
  getState(call?: CallOptions): Promise<SystemIntegrationState>
  /** Apply the OS operation and reread actual state; this is not a preferences draft write. */
  setLoginItem(enabled: boolean, call?: CallOptions): Promise<LoginItemState>
  registerProtocol(call?: CallOptions): Promise<ProtocolIntegrationState>
  registerDesktopEntry(call?: CallOptions): Promise<DesktopEntryState>
  openSettings(target: 'loginItem' | 'protocol', call?: CallOptions): Promise<void>
  setDataMode(input: DataModeChange, call?: CallOptions): Promise<DataLocationState>
}
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
/** The exit coordinator observes accepted work, including preparation before a TaskRun exists. Task counts alone cannot prove readiness. */
export type ApplicationExitState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'closing' | 'waiting' | 'failed' | 'exiting'
      readonly intent: 'quit' | 'restart' | 'installUpdate'
      readonly sessions: readonly SessionExitProgress[]
      readonly pendingRecordings: number
      readonly error: ErrorSummary | null
    }
export type ApplicationExitResult =
  | { readonly outcome: 'exiting' | 'cancelled' }
  | { readonly outcome: 'failed'; readonly error: ErrorSummary }
export interface ApplicationExitApi {
  getState(call?: CallOptions): Promise<ApplicationExitState>
  observe(listener: Listener<ApplicationExitState>): Disposable
  /** Wait for actual content, recording and resource cleanup. Never escalate ordinary close to force termination. */
  quit(call?: CallOptions): Promise<ApplicationExitResult>
  restart(call?: CallOptions): Promise<ApplicationExitResult>
  /** Resume normal acceptance; ended content and saved facts are not recreated or rolled back. */
  cancel(call?: CallOptions): Promise<void>
  /** Continue observing the accepted close work, without sending another round of process exit requests. */
  continueWaiting(call?: CallOptions): Promise<ApplicationExitResult>
}
export interface AppApi {
  readonly systemIntegration: SystemIntegrationApi
  readonly exit: ApplicationExitApi
  getEnvironment(call?: CallOptions): Promise<ApplicationEnvironment>
  /** User-invoked clipboard action; success means the safe environment summary was actually copied, never uploaded. */
  copyEnvironment(call?: CallOptions): Promise<void>
}

const mode = v.picklist(['normal', 'portable'])
const path = v.pipe(v.unknown(), v.transform(parseAbsolutePath))
const error = v.pipe(v.unknown(), v.transform(parseErrorSummary))

/** Parse only the intentionally shareable environment fields, rejecting accidental private diagnostics. */
export function parseApplicationEnvironment(input: unknown): ApplicationEnvironment {
  return parseValue(
    v.strictObject({
      version: v.pipe(
        v.unknown(),
        v.transform((value) =>
          parseExternalValue(parseVersion, value, 'Invalid application version'),
        ),
      ),
      operatingSystem: v.strictObject({ name: nonemptyText, version: nonemptyText }),
      architecture: v.picklist(['x64', 'arm64']),
    }),
    input,
    'Invalid application environment',
  )
}
/** Stable plain-text clipboard content; formatting neither reads the machine nor copies anything. */
export function formatApplicationEnvironment(input: ApplicationEnvironment): string {
  const value = parseApplicationEnvironment(input)
  return `Kisaki ${value.version}\n${value.operatingSystem.name} ${value.operatingSystem.version}\n${value.architecture}`
}
/** Failed portable-marker reads remain unavailable rather than silently selecting another profile. */
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
/** Pending restart is derived from actual current and selected modes; null means the next selection could not be read. */
export function dataModeRequiresRestart(state: DataLocationState): boolean | null {
  return state.portable.status === 'unavailable'
    ? null
    : state.portable.status === 'available' && state.current.mode !== state.portable.nextMode
}
export function parseDataModeChange(input: unknown): DataModeChange {
  return parseValue(
    v.strictObject({ mode, target: v.picklist(['existing', 'empty']) }),
    input,
    'Invalid data mode selection',
  )
}
/** Exit reports bind progress to each actual session, independently of whether another session uses the same work. */
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
/** A failed exit does not imply that previously ended sessions or committed facts have been restored. */
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
