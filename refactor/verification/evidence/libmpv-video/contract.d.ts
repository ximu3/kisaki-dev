/** Output contracts; runtime behavior is validated separately from these declarations. */
import type { MpvObserver, MpvSubscription } from '../libmpv-subscriptions/contract.js'

export interface VideoTarget {
  readonly colorSpace: 'srgb' | 'display-p3'
}

export type SoftwarePixelFormat = 'rgb0' | 'bgr0' | '0rgb' | '0bgr' | 'rgb24'

export interface GpuVideoConfiguration {
  readonly width: number
  readonly height: number
  readonly target: VideoTarget
}

export interface SoftwareVideoConfiguration {
  readonly width: number
  readonly height: number
  readonly pixelFormat: SoftwarePixelFormat
}

export type VideoDeviceSelection =
  | { readonly platform: 'win32'; readonly adapterLuid: bigint }
  | { readonly platform: 'darwin'; readonly rendererId: number }
  | { readonly platform: 'linux'; readonly renderNode: string }

export interface VideoDeviceInfo {
  readonly name: string
  readonly selection: VideoDeviceSelection
}

export declare function getVideoDevices(options?: {
  readonly signal?: AbortSignal
}): Promise<readonly VideoDeviceInfo[]>

export interface GpuVideoOptions {
  /** Omission selects the managed GPU renderer. */
  readonly renderer?: 'gpu'
  readonly width: number
  readonly height: number
  /** Defaults to sRGB. */
  readonly target?: VideoTarget
  /** Defaults to three backing textures; clones share a backing texture. */
  readonly frameCapacity?: number
  /** An explicit selection never falls back to a different device. */
  readonly device?: VideoDeviceSelection
}

export interface SoftwareVideoOptions {
  readonly renderer: 'software'
  readonly width: number
  readonly height: number
  /** Defaults to bgr0; the unused channel is not alpha. */
  readonly pixelFormat?: SoftwarePixelFormat
}

export type VideoOutputOptions = GpuVideoOptions | SoftwareVideoOptions
export type VideoOutput = GpuVideoOutput | SoftwareVideoOutput

export interface NativeDmaBufPlane {
  readonly fd: number
  readonly stride: number
  readonly offset: bigint
  readonly size: bigint
}

export type NativeFrameSurface =
  | {
      readonly kind: 'd3d11'
      readonly handle: Uint8Array<ArrayBuffer>
      readonly adapterLuid: bigint
    }
  | { readonly kind: 'ioSurface'; readonly handle: Uint8Array<ArrayBuffer> }
  | {
      readonly kind: 'dmaBuf'
      readonly format: number
      readonly modifier: bigint
      readonly planes: readonly [NativeDmaBufPlane, ...NativeDmaBufPlane[]]
    }

export declare class NativeFrame {
  private constructor()
  /** Production order within one output; not a media frame number. */
  readonly sequence: bigint
  readonly width: number
  readonly height: number
  readonly visibleRect: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }
  readonly pixelFormat: 'bgra8unorm' | 'rgba8unorm'
  readonly alphaMode: 'opaque'
  readonly target: VideoTarget
  /** Same clock as the owning Mpv.getTimeNs(); null means no scheduled target. */
  readonly targetTimeNs: bigint | null
  readonly redraw: boolean
  readonly repeat: boolean
  readonly blockVsync: boolean
  readonly released: boolean
  /** Handles are borrowed from this lease and local to its process. */
  getSurface(): NativeFrameSurface
  /** Creates an independent lease without copying pixels. */
  clone(): NativeFrame
  release(): void
  [Symbol.dispose](): void
}

export interface SoftwareFrame {
  readonly sequence: bigint
  readonly width: number
  readonly height: number
  readonly stride: number
  readonly pixelFormat: SoftwarePixelFormat
  /** Independent initialized storage owned by this receiver. */
  readonly data: Uint8Array<ArrayBuffer>
  readonly targetTimeNs: bigint | null
  readonly redraw: boolean
  readonly repeat: boolean
  readonly blockVsync: boolean
}

export declare class GpuVideoOutput {
  private constructor()
  readonly renderer: 'gpu'
  readonly configuration: GpuVideoConfiguration
  readonly frameCapacity: number
  readonly device: VideoDeviceInfo
  readonly closed: boolean
  configure(
    configuration: GpuVideoConfiguration,
    options?: {
      readonly signal?: AbortSignal
    }
  ): Promise<void>
  observeFrames(
    observer: MpvObserver<NativeFrame>,
    options?: {
      readonly signal?: AbortSignal
    }
  ): Promise<MpvSubscription>
  /** Reports a real host swap; native reporting has no timestamp or frame-id input. */
  reportSwap(): void
}

export declare class SoftwareVideoOutput {
  private constructor()
  readonly renderer: 'software'
  readonly configuration: SoftwareVideoConfiguration
  readonly closed: boolean
  configure(
    configuration: SoftwareVideoConfiguration,
    options?: {
      readonly signal?: AbortSignal
    }
  ): Promise<void>
  observeFrames(
    observer: MpvObserver<SoftwareFrame>,
    options?: {
      readonly signal?: AbortSignal
    }
  ): Promise<MpvSubscription>
  reportSwap(): void
}
