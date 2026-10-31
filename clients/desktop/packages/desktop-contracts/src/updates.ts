/** @fileoverview Defines exact application release identities and native update preparation/installation handoff. */

import * as v from 'valibot'
import { parse as parseVersion } from 'semver'
import {
  parseLanguageTag,
  parseLocalizedText,
  type LocalizedText,
} from '@kisaki3/extension-distribution/metadata'
import type { ErrorSummary } from './errors'
import { invalidInput } from './errors'
import type { CallOptions, Disposable } from './execution'
import { objectSchema } from './schema'
import type { TaskRunRef } from './tasks'
import { nonemptyStringSchema, nonnegativeIntegerSchema, parseContract } from './validation'

/** sha512 is the updater's base64 digest, separate from extension distribution SHA-256. */
export interface ApplicationReleaseFile {
  readonly url: string
  readonly size: number | null
  readonly sha512: string
}
export interface ApplicationRelease {
  readonly version: string
  readonly tagName: string
  readonly releaseUrl: string
  readonly publishedAt: number
  readonly delivery:
    | {
        readonly type: 'inApp'
        readonly files: readonly [ApplicationReleaseFile, ...ApplicationReleaseFile[]]
      }
    | { readonly type: 'manual'; readonly downloadUrl: string }
}
/** Verified selected bytes ready for installation, without exposing cache paths or pretending restart success. */
export interface PreparedApplicationUpdate {
  readonly version: string
  readonly tagName: string
  readonly files: readonly [ApplicationReleaseFile, ...ApplicationReleaseFile[]]
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
export interface ApplicationUpdateState {
  readonly currentVersion: string
  readonly check: ApplicationUpdateCheck
  readonly prepared: PreparedApplicationUpdate | null
  readonly operation: {
    readonly type: 'checking' | 'preparing' | 'installing'
    readonly taskRef?: TaskRunRef
  } | null
}
export interface UpdatesApi {
  /** Read actual check, preparation, and operation facts independently. */
  getState(call?: CallOptions): Promise<ApplicationUpdateState>
  /** Deliver the complete current snapshot and subsequent changes; disposing does not cancel preparation. */
  observe(listener: (state: ApplicationUpdateState) => void): Disposable
  /** Complete discovery and return the highest eligible upgrade, or null only after a successful no-update check. */
  check(call?: CallOptions): Promise<ApplicationRelease | null>
  /** Read this exact desktop release's localized notes; failure does not invalidate a valid update candidate. */
  getReleaseNotes(release: ApplicationRelease, call?: CallOptions): Promise<ApplicationReleaseNotes>
  /** Prepare the selected in-app release once; manual carriers reject preparation and leave prepared null. */
  prepare(release: ApplicationRelease, call?: CallOptions): Promise<PreparedApplicationUpdate>
  /** Complete normal quit coordination, then hand off the fixed prepared update; successful handoff ends the calling process. */
  installAndRestart(call?: CallOptions): Promise<never>
}
const versionSchema = v.pipe(
  nonemptyStringSchema,
  v.check((value) => {
    const version = parseVersion(value)
    return (
      version !== null &&
      value === version.version + (version.build.length ? `+${version.build.join('.')}` : '')
    )
  }),
)
const urlSchema = v.pipe(
  nonemptyStringSchema,
  v.check((value) => {
    try {
      const url = new URL(value)
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
    } catch {
      return false
    }
  }),
)
const fileSchema = objectSchema({
  url: urlSchema,
  size: v.nullable(nonnegativeIntegerSchema),
  sha512: v.pipe(
    v.string(),
    v.check((value) => {
      try {
        const bytes = atob(value)
        return bytes.length === 64 && btoa(bytes) === value
      } catch {
        return false
      }
    }),
  ),
})
/** Validate exact desktop tag identity and the carrier-specific file shape without performing discovery or download. */
export function parseApplicationRelease(input: unknown): ApplicationRelease {
  return parseContract(
    v.pipe(
      objectSchema({
        version: versionSchema,
        tagName: nonemptyStringSchema,
        releaseUrl: urlSchema,
        publishedAt: nonnegativeIntegerSchema,
        delivery: v.union([
          objectSchema({
            type: v.literal('inApp'),
            files: v.pipe(v.tupleWithRest([fileSchema], fileSchema), v.readonly()),
          }),
          objectSchema({ type: v.literal('manual'), downloadUrl: urlSchema }),
        ]),
      }),
      v.check((value) => value.tagName === `desktop@${value.version}`),
    ),
    input,
    'application release',
  )
}
/** Validate localized notes against the already selected release, preserving their independent read result. */
export function parseApplicationReleaseNotes(
  input: unknown,
  release: ApplicationRelease,
): ApplicationReleaseNotes {
  const value = parseContract(
    objectSchema({
      project: v.literal('desktop'),
      version: versionSchema,
      defaultLocale: nonemptyStringSchema,
      releaseNotes: v.unknown(),
    }),
    input,
    'application release notes',
  )
  if (value.version !== release.version) {
    return invalidInput('The release notes belong to another version.')
  }
  try {
    const defaultLocale = parseLanguageTag(value.defaultLocale)
    return {
      ...value,
      defaultLocale,
      releaseNotes: parseLocalizedText(value.releaseNotes, defaultLocale),
    }
  } catch {
    return invalidInput('The release notes localization is invalid.')
  }
}
