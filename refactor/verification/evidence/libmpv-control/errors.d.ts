/** Error specimen; video additions are proposed and runtime propagation remains unverified. */
export type MpvOperation =
  | 'createMpv'
  | 'createClient'
  | 'getClientApiVersion'
  | 'command'
  | 'getProperty'
  | 'getPropertyText'
  | 'setProperty'
  | 'loadConfigFile'
  | 'observeProperty'
  | 'observePropertyText'
  | 'observeEvents'
  | 'observeLogs'
  | 'addHook'
  | 'continueHook'
  | 'registerProtocol'
  | 'openStream'
  | 'readStream'
  | 'seekStream'
  | 'getStreamSize'
  | 'closeStream'
  | 'getVideoDevices'
  | 'configureVideoOutput'
  | 'observeFrames'
  | 'renderVideoFrame'
  | 'cloneFrame'
  | 'getFrameSurface'
  | 'reportSwap'
  | 'getTimeNs'
  | 'close'
  | 'disposeClient'
  | 'disposeSubscription'

export type MpvCreationContext =
  | {
      readonly stage:
        'input' | 'library' | 'core' | 'initializationLogs' | 'initialize' | 'video' | 'publish'
    }
  | { readonly stage: 'options'; readonly optionIndex: number }

export type MpvBindingErrorCode =
  | 'invalidArgument'
  | 'closed'
  | 'resourceLimit'
  | 'unsupportedFormat'
  | 'libraryLoadFailed'
  | 'incompatibleLibrary'
  | 'resourceCreationFailed'
  | 'unsupportedCapability'
  | 'renderConflict'
  | 'internalFailure'
  | 'reentrantStreamCall'
  | 'invalidStreamResult'
  | 'frameReleased'
  | 'renderFailed'
  | 'ABORT_ERR'
  | 'observationInterrupted'
  | 'valueConversion'
  | 'notificationConversion'

export declare abstract class MpvError extends Error {
  protected constructor()
  abstract readonly source: 'mpv' | 'binding'
  abstract readonly code: number | MpvBindingErrorCode
  readonly operation: MpvOperation
  readonly submitted: boolean
  readonly creation?: MpvCreationContext
}

export declare class MpvNativeError extends MpvError {
  private constructor()
  readonly source: 'mpv'
  /** The actual negative C return code, including unknown future values. */
  readonly code: number
  /** Exact known C enum symbol, or null for an unknown numeric code. */
  readonly nativeName: string | null
}

export declare class MpvBindingError extends MpvError {
  protected constructor()
  readonly source: 'binding'
  readonly code: MpvBindingErrorCode
}

export declare class MpvAbortError extends MpvBindingError {
  private constructor()
  readonly name: 'AbortError'
  readonly code: 'ABORT_ERR'
  readonly cause: unknown
}

export declare class MpvObservationError extends MpvBindingError {
  private constructor()
  readonly code: 'observationInterrupted'
  readonly reason: 'nativeQueueOverflow' | 'deliveryQueueOverflow'
  readonly submitted: true
}
