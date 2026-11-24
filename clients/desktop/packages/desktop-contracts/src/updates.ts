import type { CallOptions, Listener, Disposable } from './operations'
import * as v from 'valibot'
import {
  fromParser,
  parseExternalValue,
  text,
  nonnegativeInteger,
  unique,
  parseValue,
  timestamp,
} from './validation'
import { parseApplicationVersion } from './app'
import { parseHttpUrl } from './network'
import { parseErrorSummary, DesktopError, type ErrorSummary } from './errors'
import { parseTaskRunRef, type TaskRunRef } from './tasks'
import {
  normalizeLocale,
  normalizeLocalizedText,
  type LocalizedText,
} from '@kisaki3/extension-distribution/metadata'

export interface ApplicationUpdateFile {
  readonly url: string
  readonly size: number | null
  readonly sha512: string
}

export type ApplicationDelivery =
  | { readonly type: 'inApp'; readonly files: readonly ApplicationUpdateFile[] }
  | { readonly type: 'manual'; readonly downloadUrl: string }

export interface ApplicationRelease {
  readonly version: string
  readonly tagName: string
  readonly releaseUrl: string
  readonly publishedAt: number
  readonly delivery: ApplicationDelivery
}

export interface PreparedApplicationUpdate {
  readonly version: string
  readonly tagName: string
  readonly files: readonly ApplicationUpdateFile[]
}

export interface ApplicationReleaseNotes {
  readonly project: 'desktop'
  readonly version: string
  readonly defaultLocale: string
  readonly releaseNotes: LocalizedText
}

export type ApplicationUpdateCheck =
  | { readonly status: 'notChecked' }
  | {
      readonly status: 'upToDate'
      readonly checkedAt: number
    }
  | {
      readonly status: 'available'
      readonly checkedAt: number
      readonly release: ApplicationRelease
    }
  | {
      readonly status: 'failed'
      readonly checkedAt: number
      readonly error: ErrorSummary
    }

export type ApplicationUpdateOperation = { readonly taskRef?: TaskRunRef } & (
  | { readonly type: 'checking' }
  | {
      readonly type: 'preparing'
      readonly release: ApplicationRelease & {
        readonly delivery: Extract<ApplicationDelivery, { type: 'inApp' }>
      }
    }
  | { readonly type: 'installing'; readonly prepared: PreparedApplicationUpdate }
)

export interface ApplicationUpdateState {
  readonly currentVersion: string
  readonly check: ApplicationUpdateCheck
  readonly prepared: PreparedApplicationUpdate | null
  readonly operation: ApplicationUpdateOperation | null
}

export interface UpdatesApi {
  getState(call?: CallOptions): Promise<ApplicationUpdateState>

  observe(listener: Listener<ApplicationUpdateState>): Disposable

  check(call?: CallOptions): Promise<ApplicationRelease | null>

  getReleaseNotes(release: ApplicationRelease, call?: CallOptions): Promise<ApplicationReleaseNotes>

  prepare(release: ApplicationRelease, call?: CallOptions): Promise<PreparedApplicationUpdate>

  installAndRestart(call?: CallOptions): Promise<void>
}

const version = fromParser(parseApplicationVersion)

const url = fromParser(parseHttpUrl)

const sha512 = v.pipe(
  text,
  v.check((value) => /^[A-Za-z0-9+/]{85}[AQgw]==$/.test(value), 'Invalid SHA-512 digest'),
)

const file = v.strictObject({ url, size: v.nullable(nonnegativeInteger), sha512 })

const files = v.pipe(
  v.array(file),
  v.minLength(1),
  v.check((values) => unique(values, (value) => value.url)),
)

const prepared = fromParser(parsePreparedApplicationUpdate)

const release = fromParser(parseApplicationRelease)

const error = fromParser(parseErrorSummary)

const taskRef = v.exactOptional(fromParser(parseTaskRunRef))

export function getDesktopReleaseVersion(tag: string): string | null {
  if (!tag.startsWith('desktop@')) {
    return null
  }

  try {
    return parseApplicationVersion(tag.slice('desktop@'.length))
  } catch (error) {
    if (error instanceof DesktopError && error.code === 'InvalidInput') {
      return null
    }

    throw error
  }
}

export function parseApplicationRelease(input: unknown): ApplicationRelease {
  const value = parseValue(
    v.strictObject({
      version,
      tagName: text,
      releaseUrl: url,
      publishedAt: timestamp,
      delivery: v.variant('type', [
        v.strictObject({ type: v.literal('inApp'), files }),
        v.strictObject({ type: v.literal('manual'), downloadUrl: url }),
      ]),
    }),
    input,
    'Invalid application release',
  )
  if (value.tagName !== `desktop@${value.version}`) {
    throw new DesktopError('InvalidInput', 'Application release tag does not match its version')
  }

  return value
}

export function parsePreparedApplicationUpdate(input: unknown): PreparedApplicationUpdate {
  const value = parseValue(
    v.strictObject({ version, tagName: text, files }),
    input,
    'Invalid prepared application update',
  )
  if (value.tagName !== `desktop@${value.version}`) {
    throw new DesktopError('InvalidInput', 'Prepared application tag does not match its version')
  }

  return value
}

export function parseApplicationReleaseNotes(
  input: unknown,
  expectedVersion?: string,
): ApplicationReleaseNotes {
  const value = parseValue(
    v.strictObject({
      project: v.literal('desktop'),
      version,
      defaultLocale: fromParser((value) =>
        parseExternalValue(normalizeLocale, value, 'Invalid release note locale'),
      ),
      releaseNotes: v.unknown(),
    }),
    input,
    'Invalid application release notes',
  )
  if (expectedVersion !== undefined && value.version !== expectedVersion) {
    throw new DesktopError('InvalidInput', 'Release notes belong to another version')
  }

  return {
    ...value,
    releaseNotes: parseExternalValue(
      (input) => normalizeLocalizedText(input, value.defaultLocale),
      value.releaseNotes,
      'Invalid release note text',
    ),
  }
}

export function parseApplicationUpdateState(input: unknown): ApplicationUpdateState {
  return parseValue(
    v.strictObject({
      currentVersion: version,
      prepared: v.nullable(prepared),
      check: v.variant('status', [
        v.strictObject({ status: v.literal('notChecked') }),
        v.strictObject({ status: v.literal('upToDate'), checkedAt: timestamp }),
        v.strictObject({ status: v.literal('available'), checkedAt: timestamp, release }),
        v.strictObject({ status: v.literal('failed'), checkedAt: timestamp, error }),
      ]),
      operation: v.nullable(
        v.variant('type', [
          v.strictObject({ type: v.literal('checking'), taskRef }),
          v.strictObject({
            type: v.literal('preparing'),
            taskRef,
            release: v.pipe(
              release,
              v.check((value) => value.delivery.type === 'inApp'),
            ),
          }),
          v.strictObject({ type: v.literal('installing'), taskRef, prepared }),
        ]),
      ),
    }),
    input,
    'Invalid application update state',
  ) as ApplicationUpdateState
}
