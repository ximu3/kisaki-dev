/** @fileoverview Defines desktop release discovery, selected artifact preparation and the separate install handoff. */

import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { ErrorSummary } from './errors'
import type { TaskRunRef } from './tasks'
import type { CallOptions, Listener, Disposable } from './operations'
import * as v from 'valibot'
import {
  parseExternalValue,
  text,
  nonnegativeInteger,
  unique,
  parseValue,
  timestamp,
} from './validation'
import { parseApplicationVersion } from './app'
import { parseHttpUrl } from './network'
import { parseErrorSummary, DesktopError } from './errors'
import { parseTaskRunRef } from './tasks'
import { normalizeLocale, normalizeLocalizedText } from '@kisaki3/extension-distribution/metadata'

/** Release artifact address, optional byte size and canonical Base64 SHA-512 digest. */
export interface ApplicationUpdateFile {
  readonly url: string
  /** File size in bytes; null when release metadata does not provide it. */
  readonly size: number | null
  readonly sha512: string
}

/** In-app update artifacts or a manual download destination for the release. */
export type ApplicationDelivery =
  | { readonly type: 'inApp'; readonly files: readonly ApplicationUpdateFile[] }
  | { readonly type: 'manual'; readonly downloadUrl: string }

/** Desktop release identity, publication time and target-specific delivery information. */
export interface ApplicationRelease {
  readonly version: string
  readonly tagName: string
  readonly releaseUrl: string
  /** UTC milliseconds since the Unix epoch. */
  readonly publishedAt: number
  readonly delivery: ApplicationDelivery
}

/** Receipt identifying the selected desktop update bytes verified during preparation. */
export interface PreparedApplicationUpdate {
  readonly version: string
  readonly tagName: string
  readonly files: readonly ApplicationUpdateFile[]
}

/** Localized notes bound to one desktop release version. */
export interface ApplicationReleaseNotes {
  readonly project: 'desktop'
  readonly version: string
  readonly defaultLocale: string
  readonly releaseNotes: LocalizedText
}

/** Last release-check outcome, including its timestamp or safe failure summary. */
export type ApplicationUpdateCheck =
  | { readonly status: 'notChecked' }
  | {
      readonly status: 'upToDate'
      /** UTC milliseconds since the Unix epoch. */
      readonly checkedAt: number
    }
  | {
      readonly status: 'available'
      /** UTC milliseconds since the Unix epoch. */
      readonly checkedAt: number
      readonly release: ApplicationRelease
    }
  | {
      readonly status: 'failed'
      /** UTC milliseconds since the Unix epoch. */
      readonly checkedAt: number
      readonly error: ErrorSummary
    }

/**
 * Current check, artifact preparation or installation handoff with an optional managed-task
 * reference.
 */
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

/**
 * Current application version, last check, verified preparation and active update operation.
 *
 * Checking or preparing retains independent prior check and preparation facts.
 */
export interface ApplicationUpdateState {
  readonly currentVersion: string
  readonly check: ApplicationUpdateCheck
  readonly prepared: PreparedApplicationUpdate | null
  readonly operation: ApplicationUpdateOperation | null
}

/** Desktop release discovery, artifact preparation and explicit installation handoff. */
export interface UpdatesApi {
  /** Reads release-check, verified-preparation and active-operation facts independently. */
  getState(call?: CallOptions): Promise<ApplicationUpdateState>

  /**
   * Delivers current update state and subsequent changes and returns the observation lifetime.
   *
   * Ending observation leaves checking, preparation and installation running.
   */
  observe(listener: Listener<ApplicationUpdateState>): Disposable

  /**
   * Checks for a newer allowed desktop release.
   *
   * A successful check with no candidate returns null; a failed check rejects.
   */
  check(call?: CallOptions): Promise<ApplicationRelease | null>

  /**
   * Reads localized notes for the selected desktop release.
   *
   * Unavailable notes leave its verified update artifact valid.
   */
  getReleaseNotes(release: ApplicationRelease, call?: CallOptions): Promise<ApplicationReleaseNotes>

  /**
   * Acquires and verifies every selected in-app update artifact before returning a receipt.
   *
   * Manual delivery does not support preparation.
   */
  prepare(release: ApplicationRelease, call?: CallOptions): Promise<PreparedApplicationUpdate>

  /**
   * Hands the prepared update to installation and restart.
   *
   * The promise resolves after handoff only if the environment survives; successful restart
   * normally ends the old process.
   */
  installAndRestart(call?: CallOptions): Promise<void>
}

const version = v.pipe(v.unknown(), v.transform(parseApplicationVersion))

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

/**
 * Extracts a valid desktop version from its release tag, returning null for unrelated or malformed
 * tags.
 */
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

/**
 * Parses release metadata and requires the desktop tag to match its version.
 *
 * The updates owner checks origin and target support.
 */
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

/**
 * Parses a preparation receipt with matching version and tag and a nonempty, unique artifact list.
 *
 * Artifact-byte verification belongs to preparation execution.
 */
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

/**
 * Parses and normalizes localized desktop release notes, checking the expected version when
 * supplied.
 */
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

/**
 * Parses independent check, preparation and active-operation state with their associated release
 * values.
 */
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
