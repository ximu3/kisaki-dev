// Design-only declaration specimen; this is not the published package declaration.
declare const processRefBrand: unique symbol
declare const windowRefBrand: unique symbol

export interface ProcessRef {
  readonly [processRefBrand]: true
}

export interface WindowRef {
  readonly [windowRefBrand]: true
}

export type InformationUnavailableReason =
  'permissionDenied' | 'notSupported' | 'backendUnavailable' | 'temporarilyUnavailable'

export type Field<T> =
  | { readonly status: 'available'; readonly value: T }
  | { readonly status: 'unavailable'; readonly reason: InformationUnavailableReason }

export interface ProcessInfo {
  readonly ref: ProcessRef
  readonly pid: number
  readonly executableName: Field<string>
  readonly executablePath: Field<string>
  readonly displayName: Field<string>
}

export interface WindowInfo {
  readonly ref: WindowRef
  readonly nativeId: Field<string>
  readonly process: Field<ProcessRef>
  readonly title: Field<string>
  readonly visible: Field<boolean>
  readonly minimized: Field<boolean>
}

export interface ForegroundInfo {
  readonly process: Field<ProcessRef | null>
  readonly window: Field<WindowRef | null>
}

export interface WindowImage {
  readonly window: WindowRef
  readonly width: number
  readonly height: number
  readonly pixelFormat: 'rgba8'
  readonly colorSpace: 'srgb'
  readonly alphaMode: 'straight'
  readonly data: Uint8Array
}

export interface CallOptions {
  readonly signal?: AbortSignal
}

export interface WindowListOptions extends CallOptions {
  readonly process?: ProcessRef
}

export type VantageErrorCode =
  | 'invalidArgument'
  | 'referenceInvalidated'
  | 'targetEnded'
  | 'permissionDenied'
  | 'notSupported'
  | 'backendUnavailable'
  | 'requestRejected'
  | 'captureUnavailable'
  | 'timeout'
  | 'aborted'
  | 'backendFailure'

export type VantageOperation =
  | 'processes.list'
  | 'processes.find'
  | 'processes.get'
  | 'processes.observeAll'
  | 'processes.observe'
  | 'processes.requestExit'
  | 'processes.forceTerminate'
  | 'windows.list'
  | 'windows.get'
  | 'windows.observeAll'
  | 'windows.observe'
  | 'windows.restore'
  | 'windows.focus'
  | 'windows.requestClose'
  | 'windows.capture'
  | 'getForeground'
  | 'observeForeground'
  | 'macos.queryPermission'
  | 'macos.requestPermission'
  | 'observation.dispose'

export class VantageError extends Error {
  private constructor()
  readonly code: VantageErrorCode
  readonly operation: VantageOperation
}

export type ObservationEvent<T> =
  | { readonly type: 'snapshot'; readonly value: T }
  | { readonly type: 'interrupted'; readonly error: VantageError }

export type ObservationListener<T> = (event: ObservationEvent<T>) => void

export interface Observation {
  dispose(): Promise<void>
}

export interface Processes {
  list(options?: CallOptions): Promise<readonly ProcessInfo[]>
  find(pid: number, options?: CallOptions): Promise<ProcessInfo | null>
  get(ref: ProcessRef, options?: CallOptions): Promise<ProcessInfo | null>
  observeAll(
    listener: ObservationListener<readonly ProcessInfo[]>,
    options?: CallOptions
  ): Promise<Observation>
  observe(
    ref: ProcessRef,
    listener: ObservationListener<ProcessInfo | null>,
    options?: CallOptions
  ): Promise<Observation>
  requestExit(ref: ProcessRef, options?: CallOptions): Promise<void>
  forceTerminate(ref: ProcessRef, options?: CallOptions): Promise<void>
}

export interface Windows {
  list(options?: WindowListOptions): Promise<readonly WindowInfo[]>
  get(ref: WindowRef, options?: CallOptions): Promise<WindowInfo | null>
  observeAll(
    listener: ObservationListener<readonly WindowInfo[]>,
    options?: WindowListOptions
  ): Promise<Observation>
  observe(
    ref: WindowRef,
    listener: ObservationListener<WindowInfo | null>,
    options?: CallOptions
  ): Promise<Observation>
  restore(ref: WindowRef, options?: CallOptions): Promise<void>
  focus(ref: WindowRef, options?: CallOptions): Promise<void>
  requestClose(ref: WindowRef, options?: CallOptions): Promise<void>
  capture(ref: WindowRef, options?: CallOptions): Promise<WindowImage>
}

export const processes: Processes
export const windows: Windows

export function getForeground(options?: CallOptions): Promise<ForegroundInfo>
export function observeForeground(
  listener: ObservationListener<ForegroundInfo>,
  options?: CallOptions
): Promise<Observation>
