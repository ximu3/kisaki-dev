/** @fileoverview Defines desktop release discovery, selected artifact preparation and the separate install handoff. */

import * as v from 'valibot'
import {
  compareVersions,
  isPrereleaseVersion,
  parseVersion,
} from '@kisaki3/extension-distribution/compatibility'
import { normalizeLocale, normalizeLocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import { DesktopError, parseErrorSummary } from './errors'
import type { ErrorSummary } from './errors'
import { parseHttpUrl } from './network'
import type { CallOptions, Disposable, Listener } from './operations'
import { parseTaskRunRef } from './tasks'
import type { TaskRunRef } from './tasks'
import {
  nonnegativeInteger,
  parseExternalValue,
  parseValue,
  text,
  timestamp,
  unique,
} from './validation'

/** sha512 uses the updater's canonical Base64 format, never extension-distribution's hexadecimal SHA-256. */
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

/** A receipt for verified selected bytes; no preparation directory, Task ID or inferred latest release appears here. */
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
  | { readonly status: 'upToDate'; readonly checkedAt: number }
  | {
      readonly status: 'available'
      readonly checkedAt: number
      readonly release: ApplicationRelease
    }
  | { readonly status: 'failed'; readonly checkedAt: number; readonly error: ErrorSummary }

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

  /** Null means a successful check found no newer allowed release; a failed check rejects. */
  check(call?: CallOptions): Promise<ApplicationRelease | null>
  getReleaseNotes(release: ApplicationRelease, call?: CallOptions): Promise<ApplicationReleaseNotes>

  /** Manual carriers reject preparation. A successful receipt means all selected bytes have actually been verified. */
  prepare(release: ApplicationRelease, call?: CallOptions): Promise<PreparedApplicationUpdate>

  /** Resolve only for a completed handoff if the environment survives; successful restart normally ends the old process. */
  installAndRestart(call?: CallOptions): Promise<void>
}

const version = v.pipe(
  v.unknown(),
  v.transform((value) =>
    parseExternalValue(parseVersion, value, 'Invalid desktop release version'),
  ),
)

const url = v.pipe(v.unknown(), v.transform(parseHttpUrl))

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

const prepared = v.pipe(v.unknown(), v.transform(parsePreparedApplicationUpdate))
const release = v.pipe(v.unknown(), v.transform(parseApplicationRelease))
const error = v.pipe(v.unknown(), v.transform(parseErrorSummary))
const taskRef = v.exactOptional(v.pipe(v.unknown(), v.transform(parseTaskRunRef)))

/** Accept exactly the desktop release family; unrelated or malformed tags are not desktop candidates. */
export function getDesktopReleaseVersion(tag: string): string | null {
  if (!tag.startsWith('desktop@')) {
    return null
  }

  try {
    return parseExternalValue(
      parseVersion,
      tag.slice('desktop@'.length),
      'Invalid desktop release tag',
    )
  } catch (error) {
    if (error instanceof DesktopError && error.code === 'InvalidInput') {
      return null
    }

    throw error
  }
}

/** Validate a release's declared version/tag identity and carrier-specific artifact fields. Origin/target support is checked by updates. */
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

/** A prepared result cannot represent manual delivery or an incomplete file list. */
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

/** Select only from verified, target-compatible, non-draft candidates; discovery must supply all pages before selection. */
export function selectApplicationRelease(
  candidates: readonly ApplicationRelease[],
  currentVersion: string,
  allowPrerelease = false,
): ApplicationRelease | null {
  const current = parseExternalValue(
    parseVersion,
    currentVersion,
    'Invalid current application version',
  )
  let selected: ApplicationRelease | null = null
  for (const candidate of candidates) {
    const value = parseApplicationRelease(candidate)
    if (
      (!allowPrerelease && isPrereleaseVersion(value.version)) ||
      compareVersions(value.version, current) <= 0
    ) {
      continue
    }
    if (!selected || compareVersions(value.version, selected.version) > 0) {
      selected = value
    } else if (
      compareVersions(value.version, selected.version) === 0 &&
      value.tagName !== selected.tagName
    ) {
      throw new DesktopError('Conflict', 'Application release priorities collide')
    }
  }

  return selected
}

/** Release notes retain the verified desktop/version identity; missing/read failures are not represented by nullable text. */
export function parseApplicationReleaseNotes(
  input: unknown,
  expectedVersion?: string,
): ApplicationReleaseNotes {
  const value = parseValue(
    v.strictObject({
      project: v.literal('desktop'),
      version,
      defaultLocale: v.pipe(
        v.unknown(),
        v.transform((value) =>
          parseExternalValue(normalizeLocale, value, 'Invalid release note locale'),
        ),
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

/** Checking/preparing does not erase prior check/prepared results; these independent facts remain explicit in each snapshot. */
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
