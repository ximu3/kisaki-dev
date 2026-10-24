import { getVideoDevices, NativeFrame, GpuVideoOutput, SoftwareVideoOutput } from './contract.js'
import { createMpv } from '../libmpv-initialization/contract.js'
import type {
  NativeFrameSurface,
  VideoOutputOptions,
  VideoTarget,
  VideoOutput,
  SoftwareFrame,
  GpuVideoOptions
} from './contract.js'
import type { MpvSubscription } from '../libmpv-subscriptions/contract.js'

const mpv = await createMpv({
  videoOutput: { width: 1280, height: 720, frameCapacity: 3, target: { colorSpace: 'srgb' } }
})
const output: GpuVideoOutput = mpv.videoOutput
const reportHostSwap: () => void = () => output.reportSwap()
void reportHostSwap
const subscription: MpvSubscription = await output.observeFrames({
  next(frame) {
    const sequence: bigint = frame.sequence
    const target: bigint | null = frame.targetTimeNs
    const alpha: 'opaque' = frame.alphaMode
    const colorSpace: 'srgb' | 'display-p3' = frame.target.colorSpace
    const pixelFormat: 'bgra8unorm' | 'rgba8unorm' = frame.pixelFormat
    const surface: NativeFrameSurface = frame.getSurface()
    if (surface.kind === 'd3d11') {
      const handle: Uint8Array<ArrayBuffer> = surface.handle
      const adapter: bigint = surface.adapterLuid
      void [handle, adapter]
    } else if (surface.kind === 'dmaBuf') {
      const modifier: bigint = surface.modifier
      const offset: bigint = surface.planes[0].offset
      void [modifier, offset]
    }
    using retained = frame.clone()
    frame.release()
    const width: number = frame.width
    void [sequence, target, alpha, colorSpace, pixelFormat, surface, retained, width]
  },
  error(error) {
    const reason: Error = error
    void reason
  }
})
await output.configure({ ...output.configuration, width: 1920, height: 1080 })
await output.configure({
  width: 1920,
  height: 1080,
  target: { colorSpace: 'display-p3' }
})
await subscription.dispose()
await mpv.close()

const control = await createMpv()
const absent: null = control.videoOutput
const devices = await getVideoDevices()
const selection = devices[0]?.selection
await createMpv({
  videoOutput: { width: 64, height: 48, ...(selection ? { device: selection } : {}) }
})
const optional: VideoOutputOptions | undefined =
  Math.random() > 0.5 ? { width: 64, height: 48 } : undefined
const dynamic = await createMpv({ videoOutput: optional })
const possible: VideoOutput | null = dynamic.videoOutput
void [absent, possible]

const configuredControl = await createMpv({ options: [['pause', true]] })
const absentWithOptions: null = configuredControl.videoOutput
const absentWithUndefined: null = (await createMpv(undefined)).videoOutput
const cpu = await createMpv({
  options: [['hwdec', 'no']],
  videoOutput: { renderer: 'software', width: 640, height: 360, pixelFormat: 'rgb24' }
})
const software: SoftwareVideoOutput = cpu.videoOutput
await software.configure({ width: 320, height: 180, pixelFormat: 'bgr0' })
await software.observeFrames({
  next(frame) {
    const value: SoftwareFrame = frame
    const bytes: Uint8Array<ArrayBuffer> = frame.data
    bytes[0] = 0
    void [value, bytes]
  },
  error() {}
})
const nativeGpu = await createMpv({
  input: 'native',
  options: [['pause', { format: 'flag', value: true }]],
  videoOutput: {
    renderer: 'gpu',
    width: 64,
    height: 48,
    target: { colorSpace: 'display-p3' }
  },
  initializationLogs: { output: 'native', observer: { next() {}, error() {} } }
})
const withNativeOptions: GpuVideoOutput = nativeGpu.videoOutput
const defaultTargetOptions: GpuVideoOptions = { width: 64, height: 48, target: undefined }
const defaultTargetOutput: GpuVideoOutput = (await createMpv({ videoOutput: defaultTargetOptions }))
  .videoOutput
void defaultTargetOutput
const gpuWithHdrUnit = {
  videoOutput: {
    width: 64,
    height: 48,
    target: { colorSpace: 'srgb', nitsPerUnit: 240 }
  }
} as const
// @ts-expect-error Creation inference must reject HDR parameters nested in an SDR target.
await createMpv(gpuWithHdrUnit)
const nativeGpuWithHdrPeak = {
  input: 'native',
  videoOutput: {
    width: 64,
    height: 48,
    target: { colorSpace: 'display-p3', peakNits: 100 }
  }
} as const
// @ts-expect-error Native option representation does not relax the output target contract.
await createMpv(nativeGpuWithHdrPeak)
const targets: VideoTarget[] = [{ colorSpace: 'srgb' }, { colorSpace: 'display-p3' }]
for (const target of targets) await output.configure({ ...output.configuration, target })
if (possible?.renderer === 'software') {
  const narrowed: SoftwareVideoOutput = possible
  void narrowed
}
void [absentWithOptions, absentWithUndefined, withNativeOptions]

const gpuWithAlpha = {
  videoOutput: { renderer: 'gpu', width: 64, height: 48, alphaMode: 'premultiplied' }
} as const
// @ts-expect-error Managed playback has no transparent output mode.
await createMpv(gpuWithAlpha)
// @ts-expect-error Output configuration cannot change the opaque frame contract.
await output.configure({ ...output.configuration, alphaMode: 'premultiplied' })
const linearDescription = {
  colorSpace: 'linear-rgb',
  primaries: 'bt709',
  unitNits: 80,
  peakNits: 1000
} as const
// @ts-expect-error Managed SDR output does not expose arbitrary linear color descriptions.
const linearOutput: VideoTarget = linearDescription
// @ts-expect-error HLG sources do not imply an HLG output target.
const hlgOutput: VideoTarget = { colorSpace: 'bt2020-hlg', peakNits: 1000 }
const softwareWithTarget = {
  videoOutput: { renderer: 'software', width: 64, height: 48, target: { colorSpace: 'srgb' } }
} as const
// @ts-expect-error CPU output cannot silently promise the GPU color pipeline.
await createMpv(softwareWithTarget)
const softwareWithDevice = {
  videoOutput: {
    renderer: 'software',
    width: 64,
    height: 48,
    device: { platform: 'win32', adapterLuid: 1n }
  }
} as const
// @ts-expect-error CPU output does not select a GPU device.
await createMpv(softwareWithDevice)
// @ts-expect-error GPU lease capacity does not limit caller-owned CPU byte arrays.
await createMpv({ videoOutput: { renderer: 'software', width: 64, height: 48, frameCapacity: 3 } })
const softwareWithAlpha = {
  videoOutput: { renderer: 'software', width: 64, height: 48, alphaMode: 'premultiplied' }
} as const
// @ts-expect-error The software format contract does not invent an alpha mode.
await createMpv(softwareWithAlpha)
// @ts-expect-error Explicit generic arguments cannot invent an enabled output without configuration.
await createMpv<readonly [], GpuVideoOptions>()
// @ts-expect-error A configuration object still needs the explicitly claimed GPU output.
await createMpv<readonly [], GpuVideoOptions>({ options: [] })
// @ts-expect-error Renderer selection is fixed for this output's lifetime.
await output.configure({ ...output.configuration, renderer: 'software' })
// @ts-expect-error CPU configuration uses a pixel format rather than a GPU color target.
await software.configure({ width: 64, height: 48, target: { colorSpace: 'srgb' } })
// @ts-expect-error Callers cannot construct software output owners.
new SoftwareVideoOutput()
declare const softwareFrame: SoftwareFrame
// @ts-expect-error CPU byte values have no GPU lease to return.
softwareFrame.release()
// @ts-expect-error Software frames do not expose borrowed GPU handles.
softwareFrame.getSurface()
// @ts-expect-error Source properties cannot be invented as the software frame's target.
const softwareTarget = softwareFrame.target
void [linearOutput, hlgOutput, softwareTarget]

// @ts-expect-error The former placeholder string is not a second configuration shape.
await createMpv({ videoOutput: 'managed' })
// @ts-expect-error The caller must provide both physical dimensions.
await createMpv({ videoOutput: { width: 1280 } })
// @ts-expect-error Binding dimensions are bounded numbers rather than mpv INT64 values.
await createMpv({ videoOutput: { width: 1280n, height: 720 } })
// @ts-expect-error No implicit software fallback selector is introduced.
await createMpv({ videoOutput: { width: 1280, height: 720, fallback: 'software' } })
// @ts-expect-error HDR display targets are outside the managed output contract.
const pqOutput: VideoTarget = { colorSpace: 'rec2100-pq', peakNits: 1000 }
// @ts-expect-error Linear sRGB with explicit luminance units is no longer a managed target.
const srgbLinearOutput: VideoTarget = { colorSpace: 'srgb-linear', peakNits: 418, nitsPerUnit: 240 }
// @ts-expect-error SDR output does not invent a physical reference-white setting.
const sdrPeak: VideoTarget = { colorSpace: 'srgb', peakNits: 100 }
// @ts-expect-error Display P3 SDR does not accept a luminance unit.
const p3Unit: VideoTarget = { colorSpace: 'display-p3', nitsPerUnit: 240 }
const p3LinearOutput: VideoTarget = {
  // @ts-expect-error Linear Display P3 is distinct from the retained Display P3 SDR target.
  colorSpace: 'display-p3-linear',
  peakNits: 418,
  nitsPerUnit: 240
}
const rec2020LinearOutput: VideoTarget = {
  // @ts-expect-error Extended Rec.2020 linear output is no longer a managed target.
  colorSpace: 'rec2020-linear',
  peakNits: 418,
  nitsPerUnit: 240
}
// @ts-expect-error Public GPU frames no longer promise floating-point HDR storage.
const floatingOutput: NativeFrame['pixelFormat'] = 'rgba16float'
// @ts-expect-error Configuration is a full update, not an implicit merge.
await output.configure({ width: 1920, height: 1080 })
// @ts-expect-error Resource capacity is fixed at creation.
await output.configure({ ...output.configuration, frameCapacity: 4 })
// @ts-expect-error Device selection is fixed at creation.
await output.configure({ ...output.configuration, device: { platform: 'win32', adapterLuid: 1n } })
// @ts-expect-error Mpv owns output closure.
await output.close()
// @ts-expect-error Frame delivery is not an awaitable rendering participant.
await output.observeFrames({ run: () => {}, error: () => {} })
// @ts-expect-error Frame resources have no javascript/native value representation toggle.
await output.observeFrames({ next: () => {}, error: () => {} }, { output: 'native' })
// @ts-expect-error A terminal error receiver is required.
await output.observeFrames({ next: () => {} })
// @ts-expect-error Public callers cannot construct resource leases.
new NativeFrame()
// @ts-expect-error Public callers cannot construct outputs.
new GpuVideoOutput()
// @ts-expect-error A definitely absent output cannot be asserted by generic creation arguments.
const forged: VideoOutput = (await createMpv()).videoOutput
// @ts-expect-error Runtime optional output remains nullable.
const unconditional: VideoOutput = dynamic.videoOutput
await createMpv({
  // @ts-expect-error Native adapter identifiers preserve their 64-bit representation.
  videoOutput: { width: 64, height: 48, device: { platform: 'win32', adapterLuid: 1 } }
})
await createMpv({
  // @ts-expect-error Selectors use the selected platform's actual native identity.
  videoOutput: { width: 64, height: 48, device: { platform: 'linux', rendererId: 1 } }
})

declare const frame: NativeFrame
const blocksForVsync: boolean = frame.blockVsync
void blocksForVsync
// @ts-expect-error Native swap reporting does not accept an arbitrary timestamp or frame id.
output.reportSwap({ timeNs: 1n, sequence: 2n })
// @ts-expect-error Reporting a completed host swap does not await a future presentation.
const presentation: Promise<void> = output.reportSwap()
void presentation
// @ts-expect-error Release ends this lease; it is not a cancellable task.
frame.release({ signal: new AbortController().signal })
// @ts-expect-error Frame release is synchronous.
const releasing: Promise<void> = frame.release()
// @ts-expect-error Render scheduling is not the media timestamp.
const mediaPts = frame.mediaTime
// @ts-expect-error Surface handles require discriminant narrowing.
const nativeHandle = frame.getSurface().handle
// @ts-expect-error A delivered frame's color description is immutable.
frame.target.colorSpace = 'display-p3'
// @ts-expect-error Metadata is a production-time snapshot.
frame.target = { colorSpace: 'srgb' }
void [
  pqOutput,
  srgbLinearOutput,
  sdrPeak,
  p3Unit,
  p3LinearOutput,
  rec2020LinearOutput,
  floatingOutput,
  forged,
  unconditional,
  releasing,
  mediaPts,
  nativeHandle
]
