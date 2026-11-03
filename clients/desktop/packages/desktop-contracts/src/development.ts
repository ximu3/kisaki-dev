/** @fileoverview Owns the versioned development endpoint and immutable build adoption/release values, independently of RPC frames. */

import * as v from 'valibot'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { parseVersion } from '@kisaki3/extension-distribution/compatibility'
import { DesktopError, parseErrorSummary } from './errors'
import type { ErrorSummary } from './errors'
import { parseExtensionActivationResult } from './extensions'
import type { ExtensionActivationResult } from './extensions'
import { parseHttpUrl } from './network'
import { parseAbsolutePath } from './paths'
import type { CallOptions } from './operations'
import { parseViewDocument } from './ui'
import type { ViewDocument } from './ui'
import { id, parseExternalValue, parseValue, positiveInteger, unique } from './validation'

export const developmentProtocolId = 'kisaki.development'
export const developmentProtocolVersion = 1
/** Build numbers increase per extension on this connection. Directories stay immutable until their real readers release them. */
export interface DevelopmentBuild {
  readonly extensionId: string
  readonly buildId: number
  readonly rootPath: string
  readonly webviews: readonly { readonly document: ViewDocument; readonly url: string }[]
}
export interface DevelopmentBuildRef {
  readonly extensionId: string
  readonly buildId: number
}
export type DevelopmentBuildResult = DevelopmentBuildRef &
  (
    | { readonly outcome: 'adopted' }
    | { readonly outcome: 'notAdopted'; readonly error: ErrorSummary }
  )
export type DevelopmentActivationResult = ExtensionActivationResult
/** Interrupted reports contain only known results. Other affected installed extensions can appear among activation attempts. */
export type DevelopmentAdoptionResult = {
  readonly builds: readonly DevelopmentBuildResult[]
  readonly activations: readonly DevelopmentActivationResult[]
} & (
  | { readonly outcome: 'completed' }
  | { readonly outcome: 'interrupted'; readonly error: ErrorSummary }
)
export interface DevelopmentAccepted {
  readonly appVersion: string
  readonly buildId: string
}
export interface DevelopmentReady extends DevelopmentAccepted {
  readonly apiVersion: string | null
}
export type DevelopmentStopResult =
  | { readonly outcome: 'exiting' | 'cancelled' }
  | { readonly outcome: 'failed'; readonly error: ErrorSummary }
export interface DevelopmentNotifications {
  readonly ready: DevelopmentReady
  readonly buildsReleased: { readonly builds: readonly DevelopmentBuildRef[] }
  readonly exiting: Readonly<Record<string, never>>
  readonly failed: { readonly error: ErrorSummary }
}
export interface DevelopmentApi {
  /** Accept one complete batch at a time, preserving each actual adoption and shared-host activation result. */
  adoptBuilds(
    builds: readonly DevelopmentBuild[],
    call?: CallOptions,
  ): Promise<DevelopmentAdoptionResult>
  /** Normal user-aware shutdown; cancellation keeps the current application and development resources in use. */
  stop(call?: CallOptions): Promise<DevelopmentStopResult>
}

const extensionId = v.pipe(
  v.unknown(),
  v.transform((value) => parseExternalValue(parseId, value, 'Invalid extension identity')),
)
const version = v.pipe(
  v.unknown(),
  v.transform((value) => parseExternalValue(parseVersion, value, 'Invalid development version')),
)
const error = v.pipe(v.unknown(), v.transform(parseErrorSummary))
const ref = v.strictObject({ extensionId, buildId: positiveInteger })
const buildResult = v.variant('outcome', [
  v.strictObject({ extensionId, buildId: positiveInteger, outcome: v.literal('adopted') }),
  v.strictObject({
    extensionId,
    buildId: positiveInteger,
    outcome: v.literal('notAdopted'),
    error,
  }),
])
const activation = v.pipe(v.unknown(), v.transform(parseExtensionActivationResult))

/** A loopback name is necessary, not sufficient: the receiving host also verifies this actual session owns the server. */
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
/** Reject duplicate document mappings and incomplete directory values before any application-side read. */
export function parseDevelopmentBuild(input: unknown): DevelopmentBuild {
  return parseValue(
    v.strictObject({
      extensionId,
      buildId: positiveInteger,
      rootPath: v.pipe(v.unknown(), v.transform(parseAbsolutePath)),
      webviews: v.pipe(
        v.array(
          v.strictObject({
            document: v.pipe(v.unknown(), v.transform(parseViewDocument)),
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
/** A batch has one fixed candidate per extension; monotonicity across batches is checked by the live endpoint. */
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
/** Accepted is handshake identity only; ready separately states whether the actual extension API exists. */
export function parseDevelopmentAccepted(input: unknown): DevelopmentAccepted {
  return parseValue(
    v.strictObject({ appVersion: version, buildId: id }),
    input,
    'Invalid development acceptance',
  )
}
export function parseDevelopmentReady(input: unknown): DevelopmentReady {
  return parseValue(
    v.strictObject({ appVersion: version, buildId: id, apiVersion: v.nullable(version) }),
    input,
    'Invalid development ready notification',
  )
}
/** When the batch is supplied, ensure every completed receipt matches its actual candidate and input order. */
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
/** A release notification means no reader remains, not merely that a newer build was sent or adopted. */
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
/** Failed stop requires a safe error; exiting and user cancellation do not pretend the child process has already exited. */
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
