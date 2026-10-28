/**
 * @fileoverview Defines and parses the shared development-launch and parent-child IPC
 * protocol used by the desktop and extension tooling.
 */

import type { ErrorSummary } from './errors'

/** Version of the finite parent-child development messages, independent of extension API versions. */
export const developmentProtocolVersion = 1

/** Explicit application switches; profile is also available to isolated source test launches. */
export const developmentLaunchSwitches = { mode: 'development', profile: 'profile' } as const

/** An immutable candidate owned by the tool until the application releases every reader. */
export interface DevelopmentBuildReference {
  extensionId: string
  /** Positive, increasing integer within this extension's current development connection. */
  buildId: number
}

/** Complete output and explicit document mappings; paths and permissions are checked by main. */
export interface DevelopmentBuild extends DevelopmentBuildReference {
  rootPath: string
  webviews: readonly { document: string; url: string }[]
}

/** Application readiness does not imply that any extension has activated. */
export interface DevelopmentReady {
  type: 'ready'
  protocolVersion: number
  appVersion: string
  /** Null means this application does not expose an extension runtime API. */
  apiVersion: string | null
  buildId: string
}

/** Adoption and activation are separate facts; a failed activation does not undo adoption. */
export type DevelopmentBuildResult = DevelopmentBuildReference &
  ({ outcome: 'adopted' } | { outcome: 'notAdopted'; error: ErrorSummary })

/** Only actual activation attempts appear in an adoption result. */
export type DevelopmentActivationResult =
  | { extensionId: string; instanceId: string; outcome: 'activated' }
  | { extensionId: string; outcome: 'failed'; error: ErrorSummary }

/** One result for the sole in-flight batch; interrupted results retain only established facts. */
export type DevelopmentAdoptionResult = {
  type: 'adoptionResult'
  builds: readonly DevelopmentBuildResult[]
  activations: readonly DevelopmentActivationResult[]
} & ({ outcome: 'completed' } | { outcome: 'interrupted'; error: ErrorSummary })

/** Exiting announces accepted shutdown; only the child process exit confirms completion. */
export type DevelopmentStopResult = { type: 'stopResult' } & (
  { outcome: 'cancelled' | 'exiting' } | { outcome: 'failed'; error: ErrorSummary }
)

/** Commands belong to one actual child connection; initialization precedes all other commands. */
export type DevelopmentCommand =
  | { type: 'initialize'; protocolVersion: number }
  | { type: 'buildsReady'; builds: readonly DevelopmentBuild[] }
  | { type: 'stop' }

/** Application events contain facts, never serialized objects, methods or transport identities. */
export type DevelopmentEvent =
  | DevelopmentReady
  | DevelopmentAdoptionResult
  | { type: 'buildsReleased'; builds: readonly DevelopmentBuildReference[] }
  | DevelopmentStopResult
  | { type: 'failed'; error: ErrorSummary }

/** Require a JSON record with exactly the fields defined by its message branch. */
function assertRecordFields<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): asserts value is Record<Keys[number], unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(value, key))
  ) {
    throw new Error('Invalid development message fields')
  }
}

function assertNonemptyText(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('Invalid development text')
}

function validatePositiveInteger(value: unknown): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error('Invalid development integer')
  }
}

function validateErrorSummary(value: unknown): void {
  assertRecordFields(value, ['code', 'message'])
  assertNonemptyText(value.code)
  assertNonemptyText(value.message)
}

function validateBuildReference(value: Record<string, unknown>): void {
  assertNonemptyText(value.extensionId)
  validatePositiveInteger(value.buildId)
}

function assertArray(value: unknown, check: (item: unknown) => void): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Error('Invalid development list')

  value.forEach(check)
}

/** Parse each incoming command once; executable paths and operation state remain main's responsibility. */
export function parseDevelopmentCommand(value: unknown): DevelopmentCommand {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    throw new Error('Invalid development command')
  }

  switch (value.type) {
    case 'initialize':
      assertRecordFields(value, ['type', 'protocolVersion'])
      validatePositiveInteger(value.protocolVersion)
      break
    case 'stop':
      assertRecordFields(value, ['type'])
      break
    case 'buildsReady': {
      assertRecordFields(value, ['type', 'builds'])

      const ids = new Set<string>()
      assertArray(value.builds, (build) => {
        assertRecordFields(build, ['extensionId', 'buildId', 'rootPath', 'webviews'])
        validateBuildReference(build)
        assertNonemptyText(build.rootPath)
        assertNonemptyText(build.extensionId)
        if (ids.has(build.extensionId)) throw new Error('Duplicate development extension')

        ids.add(build.extensionId)

        assertArray(build.webviews, (view) => {
          assertRecordFields(view, ['document', 'url'])
          assertNonemptyText(view.document)
          assertNonemptyText(view.url)
        })
      })

      if (!value.builds.length) throw new Error('Empty development build batch')
      break
    }
    default:
      throw new Error('Unknown development command')
  }

  return value as DevelopmentCommand
}

/** Parse application events; the launcher additionally enforces connection and request ordering. */
export function parseDevelopmentEvent(value: unknown): DevelopmentEvent {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    throw new Error('Invalid development event')
  }

  switch (value.type) {
    case 'ready':
      assertRecordFields(value, ['type', 'protocolVersion', 'appVersion', 'apiVersion', 'buildId'])
      validatePositiveInteger(value.protocolVersion)
      assertNonemptyText(value.appVersion)
      if (value.apiVersion !== null) assertNonemptyText(value.apiVersion)
      assertNonemptyText(value.buildId)
      break
    case 'failed':
      assertRecordFields(value, ['type', 'error'])
      validateErrorSummary(value.error)
      break
    case 'stopResult':
      if ('outcome' in value && value.outcome === 'failed') {
        assertRecordFields(value, ['type', 'outcome', 'error'])
        validateErrorSummary(value.error)
      } else {
        assertRecordFields(value, ['type', 'outcome'])
        if (!['cancelled', 'exiting'].includes(value.outcome as string)) {
          throw new Error('Invalid development stop outcome')
        }
      }
      break
    case 'buildsReleased':
      assertRecordFields(value, ['type', 'builds'])
      assertArray(value.builds, (build) => {
        assertRecordFields(build, ['extensionId', 'buildId'])
        validateBuildReference(build)
      })
      break
    case 'adoptionResult':
      if ('outcome' in value && value.outcome === 'interrupted') {
        assertRecordFields(value, ['type', 'builds', 'activations', 'outcome', 'error'])
        validateErrorSummary(value.error)
      } else {
        assertRecordFields(value, ['type', 'builds', 'activations', 'outcome'])
        if (value.outcome !== 'completed') throw new Error('Invalid development adoption outcome')
      }

      assertArray(value.builds, (build) => {
        if (
          build &&
          typeof build === 'object' &&
          'outcome' in build &&
          build.outcome === 'notAdopted'
        ) {
          assertRecordFields(build, ['extensionId', 'buildId', 'outcome', 'error'])
          validateErrorSummary(build.error)
        } else {
          assertRecordFields(build, ['extensionId', 'buildId', 'outcome'])
          if (build.outcome !== 'adopted') throw new Error('Invalid development build outcome')
        }

        validateBuildReference(build)
      })

      assertArray(value.activations, (activation) => {
        if (
          activation &&
          typeof activation === 'object' &&
          'outcome' in activation &&
          activation.outcome === 'failed'
        ) {
          assertRecordFields(activation, ['extensionId', 'outcome', 'error'])
          validateErrorSummary(activation.error)
        } else {
          assertRecordFields(activation, ['extensionId', 'instanceId', 'outcome'])
          if (activation.outcome !== 'activated') {
            throw new Error('Invalid development activation outcome')
          }
          assertNonemptyText(activation.instanceId)
        }

        assertNonemptyText(activation.extensionId)
      })
      break
    default:
      throw new Error('Unknown development event')
  }

  return value as DevelopmentEvent
}
