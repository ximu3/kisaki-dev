import type { CallOptions } from './operations'
import * as v from 'valibot'
import {
  fromParser,
  parseExternalValue,
  positiveInteger,
  parseValue,
  unique,
  id,
} from './validation'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { parseVersion } from '@kisaki3/extension-distribution/compatibility'
import { parseErrorSummary, DesktopError, type ErrorSummary } from './errors'
import { parseExtensionActivationResult, type ExtensionActivationResult } from './extensions'
import { parseHttpUrl } from './network'
import { parseAbsolutePath } from './paths'
import { parseExtensionViewDocument, type ExtensionViewDocument } from './ui/views'
import { parseApplicationVersion } from './app'

export const developmentProtocolId = 'kisaki.development'

export const developmentProtocolVersion = 1

export interface DevelopmentBuild {
  readonly extensionId: string
  readonly buildId: number
  readonly rootPath: string
  readonly webviews: readonly { readonly document: ExtensionViewDocument; readonly url: string }[]
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
  adoptBuilds(
    builds: readonly DevelopmentBuild[],
    call?: CallOptions,
  ): Promise<DevelopmentAdoptionResult>

  stop(call?: CallOptions): Promise<DevelopmentStopResult>
}

const extensionId = fromParser((value) =>
  parseExternalValue(parseId, value, 'Invalid extension identity'),
)

const version = fromParser((value) =>
  parseExternalValue(parseVersion, value, 'Invalid development version'),
)

const appVersion = fromParser(parseApplicationVersion)

const error = fromParser(parseErrorSummary)

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

const activation = fromParser(parseExtensionActivationResult)

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

export function parseDevelopmentBuild(input: unknown): DevelopmentBuild {
  return parseValue(
    v.strictObject({
      extensionId,
      buildId: positiveInteger,
      rootPath: fromParser(parseAbsolutePath),
      webviews: v.pipe(
        v.array(
          v.strictObject({
            document: fromParser(parseExtensionViewDocument),
            url: fromParser(parseDevelopmentUrl),
          }),
        ),
        v.check((views) => unique(views, (view) => JSON.stringify(view.document))),
      ),
    }),
    input,
    'Invalid development build',
  )
}

export function parseDevelopmentBuilds(input: unknown): readonly DevelopmentBuild[] {
  return parseValue(
    v.pipe(
      v.array(fromParser(parseDevelopmentBuild)),
      v.check((builds) => unique(builds, (build) => build.extensionId)),
    ),
    input,
    'Invalid development build batch',
  )
}

export function parseDevelopmentAccepted(input: unknown): DevelopmentAccepted {
  return parseValue(
    v.strictObject({ appVersion, buildId: id }),
    input,
    'Invalid development acceptance',
  )
}

export function parseDevelopmentReady(input: unknown): DevelopmentReady {
  return parseValue(
    v.strictObject({ appVersion, buildId: id, apiVersion: v.nullable(version) }),
    input,
    'Invalid development ready notification',
  )
}

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
