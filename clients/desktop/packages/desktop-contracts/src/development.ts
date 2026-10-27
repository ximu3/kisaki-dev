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
  /** Null means this application does not yet implement extension loading. */
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
function record<const Keys extends readonly string[]>(
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

function text(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('Invalid development text')
}

function integer(value: unknown): void {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error('Invalid development integer')
  }
}

function error(value: unknown): void {
  record(value, ['code', 'message'])
  text(value.code)
  text(value.message)
}

function reference(value: Record<string, unknown>): void {
  text(value.extensionId)
  integer(value.buildId)
}

function array(value: unknown, check: (item: unknown) => void): asserts value is unknown[] {
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
      record(value, ['type', 'protocolVersion'])
      integer(value.protocolVersion)
      break
    case 'stop':
      record(value, ['type'])
      break
    case 'buildsReady': {
      record(value, ['type', 'builds'])
      const ids = new Set<string>()
      array(value.builds, (build) => {
        record(build, ['extensionId', 'buildId', 'rootPath', 'webviews'])
        reference(build)
        text(build.rootPath)
        text(build.extensionId)
        if (ids.has(build.extensionId)) throw new Error('Duplicate development extension')
        ids.add(build.extensionId)
        array(build.webviews, (view) => {
          record(view, ['document', 'url'])
          text(view.document)
          text(view.url)
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
      record(value, ['type', 'protocolVersion', 'appVersion', 'apiVersion', 'buildId'])
      integer(value.protocolVersion)
      text(value.appVersion)
      if (value.apiVersion !== null) text(value.apiVersion)
      text(value.buildId)
      break
    case 'failed':
      record(value, ['type', 'error'])
      error(value.error)
      break
    case 'stopResult':
      if ('outcome' in value && value.outcome === 'failed') {
        record(value, ['type', 'outcome', 'error'])
        error(value.error)
      } else {
        record(value, ['type', 'outcome'])
        if (!['cancelled', 'exiting'].includes(value.outcome as string)) {
          throw new Error('Invalid development stop outcome')
        }
      }
      break
    case 'buildsReleased':
      record(value, ['type', 'builds'])
      array(value.builds, (build) => {
        record(build, ['extensionId', 'buildId'])
        reference(build)
      })
      break
    case 'adoptionResult':
      if ('outcome' in value && value.outcome === 'interrupted') {
        record(value, ['type', 'builds', 'activations', 'outcome', 'error'])
        error(value.error)
      } else {
        record(value, ['type', 'builds', 'activations', 'outcome'])
        if (value.outcome !== 'completed') throw new Error('Invalid development adoption outcome')
      }
      array(value.builds, (build) => {
        if (
          build &&
          typeof build === 'object' &&
          'outcome' in build &&
          build.outcome === 'notAdopted'
        ) {
          record(build, ['extensionId', 'buildId', 'outcome', 'error'])
          error(build.error)
        } else {
          record(build, ['extensionId', 'buildId', 'outcome'])
          if (build.outcome !== 'adopted') throw new Error('Invalid development build outcome')
        }
        reference(build)
      })
      array(value.activations, (activation) => {
        if (
          activation &&
          typeof activation === 'object' &&
          'outcome' in activation &&
          activation.outcome === 'failed'
        ) {
          record(activation, ['extensionId', 'outcome', 'error'])
          error(activation.error)
        } else {
          record(activation, ['extensionId', 'instanceId', 'outcome'])
          if (activation.outcome !== 'activated') {
            throw new Error('Invalid development activation outcome')
          }
          text(activation.instanceId)
        }
        text(activation.extensionId)
      })
      break
    default:
      throw new Error('Unknown development event')
  }
  return value as DevelopmentEvent
}
