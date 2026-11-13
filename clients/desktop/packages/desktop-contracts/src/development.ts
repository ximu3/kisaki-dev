/** @fileoverview Owns the versioned development endpoint and immutable build adoption/release values, independently of RPC frames. */

import type { ExtensionViewDocument } from './ui/views'
import type { ErrorSummary } from './errors'
import type { ExtensionActivationResult } from './extensions'
import type { CallOptions } from './operations'
import * as v from 'valibot'
import { parseExternalValue, positiveInteger, parseValue, unique, id } from './validation'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { parseVersion } from '@kisaki3/extension-distribution/compatibility'
import { parseErrorSummary, DesktopError } from './errors'
import { parseExtensionActivationResult } from './extensions'
import { parseHttpUrl } from './network'
import { parseAbsolutePath } from './paths'
import { parseExtensionViewDocument } from './ui/views'
import { parseApplicationVersion } from './app'

/** Wire identity of the desktop extension-development control protocol. */
export const developmentProtocolId = 'kisaki.development'

/** Current development-control wire version, independent of application release versions. */
export const developmentProtocolVersion = 1

/**
 * An immutable extension build and its development document mappings.
 *
 * Build numbers increase per extension on the connection. Directories remain unchanged until their
 * actual readers release them.
 */
export interface DevelopmentBuild {
  readonly extensionId: string
  readonly buildId: number
  readonly rootPath: string
  readonly webviews: readonly { readonly document: ExtensionViewDocument; readonly url: string }[]
}

/** An extension build identity scoped to the development connection. */
export interface DevelopmentBuildRef {
  readonly extensionId: string
  readonly buildId: number
}

/** The actual adoption outcome for one requested extension build. */
export type DevelopmentBuildResult = DevelopmentBuildRef &
  (
    | { readonly outcome: 'adopted' }
    | { readonly outcome: 'notAdopted'; readonly error: ErrorSummary }
  )

/** An extension activation outcome reported during development build adoption. */
export type DevelopmentActivationResult = ExtensionActivationResult

/**
 * Build-adoption receipts and shared-host activation outcomes for one batch.
 *
 * Interrupted reports contain only known results. Activation attempts can include other affected
 * installed extensions.
 */
export type DevelopmentAdoptionResult = {
  readonly builds: readonly DevelopmentBuildResult[]
  readonly activations: readonly DevelopmentActivationResult[]
} & (
  | { readonly outcome: 'completed' }
  | { readonly outcome: 'interrupted'; readonly error: ErrorSummary }
)

/** The application version and build identity accepted during the development handshake. */
export interface DevelopmentAccepted {
  readonly appVersion: string
  readonly buildId: string
}

/**
 * The ready development peer's identity and available extension API version.
 *
 * A null apiVersion means the extension API is unavailable; readiness alone does not establish
 * extension activation.
 */
export interface DevelopmentReady extends DevelopmentAccepted {
  readonly apiVersion: string | null
}

/** The outcome of a development stop request before actual process exit is observed. */
export type DevelopmentStopResult =
  | { readonly outcome: 'exiting' | 'cancelled' }
  | { readonly outcome: 'failed'; readonly error: ErrorSummary }

/** Development peer readiness, resource release and terminal notifications. */
export interface DevelopmentNotifications {
  readonly ready: DevelopmentReady
  /** Builds with no remaining readers, whose directories the development tool can reclaim. */
  readonly buildsReleased: { readonly builds: readonly DevelopmentBuildRef[] }
  readonly exiting: Readonly<Record<string, never>>
  readonly failed: { readonly error: ErrorSummary }
}

/** Development build adoption and coordinated application shutdown. */
export interface DevelopmentApi {
  /** Accepts one complete batch at a time and reports actual adoption and activation outcomes. */
  adoptBuilds(
    builds: readonly DevelopmentBuild[],
    call?: CallOptions,
  ): Promise<DevelopmentAdoptionResult>

  /**
   * Requests normal user-aware shutdown.
   *
   * Cancellation keeps the application and its development resources in use.
   */
  stop(call?: CallOptions): Promise<DevelopmentStopResult>
}

/** Validated extension identity carried by development control messages. */
const extensionId = v.pipe(
  v.unknown(),
  v.transform((value) => parseExternalValue(parseId, value, 'Invalid extension identity')),
)

/** Validated extension build version reported through development control. */
const version = v.pipe(
  v.unknown(),
  v.transform((value) => parseExternalValue(parseVersion, value, 'Invalid development version')),
)

/** Validated application release version used by development handshakes. */
const appVersion = v.pipe(v.unknown(), v.transform(parseApplicationVersion))

/** Safe failure details carried by development control results. */
const error = v.pipe(v.unknown(), v.transform(parseErrorSummary))

/** Exact extension and positive build generation addressed by one control operation. */
const ref = v.strictObject({ extensionId, buildId: positiveInteger })

/** Adoption outcome for one exact development build, retaining failed-adoption details. */
const buildResult = v.variant('outcome', [
  v.strictObject({ extensionId, buildId: positiveInteger, outcome: v.literal('adopted') }),
  v.strictObject({
    extensionId,
    buildId: positiveInteger,
    outcome: v.literal('notAdopted'),
    error,
  }),
])

/** Validated activation outcome kept separate from build adoption. */
const activation = v.pipe(v.unknown(), v.transform(parseExtensionActivationResult))

/**
 * Parses a loopback HTTP or HTTPS document URL without a fragment.
 *
 * The receiving host separately verifies that the actual session owns the server.
 */
export function parseDevelopmentUrl(input: unknown): string {
  const value = parseHttpUrl(input)
  const url = new URL(value)
  if (
    !(
      url.hostname === 'localhost' ||
      url.hostname === '[::1]' ||
      /^127\.\d+\.\d+\.\d+$/.test(url.hostname)
    ) ||
    url.hash
  ) {
    throw new DesktopError('InvalidInput', 'Development documents require an owned loopback server')
  }

  return value
}

/** Parses a build directory and unique document mappings before application-side reads. */
export function parseDevelopmentBuild(input: unknown): DevelopmentBuild {
  return parseValue(
    v.strictObject({
      extensionId,
      buildId: positiveInteger,
      rootPath: v.pipe(v.unknown(), v.transform(parseAbsolutePath)),
      webviews: v.pipe(
        v.array(
          v.strictObject({
            document: v.pipe(v.unknown(), v.transform(parseExtensionViewDocument)),
            url: v.pipe(v.unknown(), v.transform(parseDevelopmentUrl)),
          }),
        ),
        v.check((views) => unique(views, (view) => JSON.stringify(view.document))),
      ),
    }),
    input,
    'Invalid development build',
  )
}

/**
 * Parses a batch with at most one candidate per extension.
 *
 * The live endpoint checks build-number monotonicity across batches.
 */
export function parseDevelopmentBuilds(input: unknown): readonly DevelopmentBuild[] {
  return parseValue(
    v.pipe(
      v.array(v.pipe(v.unknown(), v.transform(parseDevelopmentBuild))),
      v.check((builds) => unique(builds, (build) => build.extensionId)),
    ),
    input,
    'Invalid development build batch',
  )
}

/** Parses application identity from a development handshake acceptance. */
export function parseDevelopmentAccepted(input: unknown): DevelopmentAccepted {
  return parseValue(
    v.strictObject({ appVersion, buildId: id }),
    input,
    'Invalid development acceptance',
  )
}

/** Parses the ready peer's build identity and nullable extension API version. */
export function parseDevelopmentReady(input: unknown): DevelopmentReady {
  return parseValue(
    v.strictObject({ appVersion, buildId: id, apiVersion: v.nullable(version) }),
    input,
    'Invalid development ready notification',
  )
}

/**
 * Parses adoption and activation outcomes.
 *
 * When requested builds are supplied, receipts must identify those builds in input order. Completed
 * reports must include every requested build; interrupted reports may contain a subset.
 */
export function parseDevelopmentAdoptionResult(
  input: unknown,
  requested?: readonly DevelopmentBuildRef[],
): DevelopmentAdoptionResult {
  const fields = {
    builds: v.pipe(
      v.array(buildResult),
      v.check((values) => unique(values, (value) => value.extensionId)),
    ),
    activations: v.pipe(
      v.array(activation),
      v.check((values) => unique(values, (value) => value.extensionId)),
    ),
  }
  const value = parseValue(
    v.variant('outcome', [
      v.strictObject({ outcome: v.literal('completed'), ...fields }),
      v.strictObject({ outcome: v.literal('interrupted'), error, ...fields }),
    ]),
    input,
    'Invalid development adoption result',
  )
  if (requested) {
    let previous = -1
    for (const result of value.builds) {
      const index = requested.findIndex(
        (build) => build.extensionId === result.extensionId && build.buildId === result.buildId,
      )
      if (index <= previous) {
        throw new DesktopError(
          'InvalidInput',
          'Development result does not match its requested batch',
        )
      }
      previous = index
    }

    if (value.outcome === 'completed' && value.builds.length !== requested.length) {
      throw new DesktopError(
        'InvalidInput',
        'Completed development batch is missing a build result',
      )
    }
  }

  return value
}

/** Parses a release notification with distinct extension-and-build identities. */
export function parseBuildsReleased(input: unknown): DevelopmentNotifications['buildsReleased'] {
  return parseValue(
    v.strictObject({
      builds: v.pipe(
        v.array(ref),
        v.check((values) => unique(values, (value) => `${value.extensionId}:${value.buildId}`)),
      ),
    }),
    input,
    'Invalid build release notification',
  )
}

/** Parses the stop outcome, requiring a safe error when shutdown failed. */
export function parseDevelopmentStopResult(input: unknown): DevelopmentStopResult {
  return parseValue(
    v.variant('outcome', [
      v.strictObject({ outcome: v.picklist(['exiting', 'cancelled']) }),
      v.strictObject({ outcome: v.literal('failed'), error }),
    ]),
    input,
    'Invalid development stop result',
  )
}
