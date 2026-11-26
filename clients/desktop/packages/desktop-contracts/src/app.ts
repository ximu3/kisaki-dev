import type { CallOptions, Listener, Disposable } from './operations'
import * as v from 'valibot'
import { parseAbsolutePath } from './paths'
import { parseErrorSummary, DesktopError, type ErrorSummary } from './errors'
import {
  fromParser,
  parseValue,
  parseExternalValue,
  nonemptyText,
  id,
  unique,
  nonnegativeInteger,
} from './validation'
import { parseVersion } from '@kisaki3/extension-distribution/compatibility'
import { parseWorkRef, type WorkType, type WorkRef } from './library/catalog'

export const applicationIdentities = Object.freeze({
  production: { name: 'Kisaki', appId: 'me.kisaki', scheme: 'kisaki' },
  development: { name: 'Kisaki Dev', appId: 'me.kisaki.dev', scheme: 'kisaki-dev' },
} as const)

export interface ApplicationEnvironment {
  readonly version: string
  readonly operatingSystem: { readonly name: string; readonly version: string }
  readonly architecture: 'x64' | 'arm64'
}

export type DataMode = 'normal' | 'portable'

export interface DataLocationState {
  readonly current: { readonly mode: DataMode; readonly path: string }
  readonly normalPath: string
  readonly portable:
    | { readonly status: 'unsupported' }
    | { readonly status: 'available'; readonly path: string; readonly nextMode: DataMode }
    | { readonly status: 'unavailable'; readonly error: ErrorSummary }
}

export interface DataModeChange {
  readonly mode: DataMode
  readonly target: 'existing' | 'empty'
}

export type LoginItemState =
  | {
      readonly status: 'available'
      readonly registered: boolean
      readonly permission: 'allowed' | 'requiresApproval' | 'denied' | 'notApplicable'
      readonly settingsAvailable: boolean
    }
  | { readonly status: 'unsupported' }
  | { readonly status: 'unavailable'; readonly error: ErrorSummary }

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

  quit(call?: CallOptions): Promise<ApplicationExitResult>

  restart(call?: CallOptions): Promise<ApplicationExitResult>

  cancel(call?: CallOptions): Promise<void>

  continueWaiting(call?: CallOptions): Promise<ApplicationExitResult>
}

export interface AppApi {
  readonly systemIntegration: SystemIntegrationApi
  readonly exit: ApplicationExitApi

  getEnvironment(call?: CallOptions): Promise<ApplicationEnvironment>

  copyEnvironment(call?: CallOptions): Promise<void>
}

const mode = v.picklist(['normal', 'portable'])

const path = fromParser(parseAbsolutePath)

const error = fromParser(parseErrorSummary)

export function parseApplicationVersion(input: unknown): string {
  const version = parseExternalValue(parseVersion, input, 'Invalid application version')
  if (version.includes('+')) {
    throw new DesktopError('InvalidInput', 'Application versions cannot contain build metadata')
  }

  return version
}

export function parseApplicationEnvironment(input: unknown): ApplicationEnvironment {
  return parseValue(
    v.strictObject({
      version: fromParser(parseApplicationVersion),
      operatingSystem: v.strictObject({ name: nonemptyText, version: nonemptyText }),
      architecture: v.picklist(['x64', 'arm64']),
    }),
    input,
    'Invalid application environment',
  )
}

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

export function parseDataModeChange(input: unknown): DataModeChange {
  return parseValue(
    v.strictObject({ mode, target: v.picklist(['existing', 'empty']) }),
    input,
    'Invalid data mode selection',
  )
}

export function parseSessionExitProgress(input: unknown): SessionExitProgress {
  const value = parseValue(
    v.strictObject({
      sessionId: id,
      work: fromParser(parseWorkRef),
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

export function parseApplicationExitState(input: unknown): ApplicationExitState {
  return parseValue(
    v.variant('status', [
      v.strictObject({ status: v.literal('idle') }),
      v.strictObject({
        status: v.picklist(['closing', 'waiting', 'failed', 'exiting']),
        intent: v.picklist(['quit', 'restart', 'installUpdate']),
        sessions: v.pipe(
          v.array(fromParser(parseSessionExitProgress)),
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
