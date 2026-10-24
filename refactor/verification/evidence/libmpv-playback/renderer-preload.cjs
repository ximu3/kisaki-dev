const { ipcRenderer, sharedTexture } = require('electron')
const send = (key, value) => ipcRenderer.send('display-probe', { key, value })

function half(bits) {
  const exponent = (bits >>> 10) & 31
  const fraction = bits & 1023
  const sign = bits & 0x8000 ? -1 : 1
  return exponent === 31
    ? fraction
      ? NaN
      : sign * Infinity
    : sign * (exponent ? 2 ** (exponent - 15) * (1 + fraction / 1024) : 2 ** -24 * fraction)
}

async function inspectWebGpu(frame) {
  if (!navigator.gpu) return { supported: false, reason: 'api-unavailable' }
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) return { supported: false, reason: 'adapter-unavailable' }
  const device = await adapter.requestDevice()
  device.pushErrorScope('validation')
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 4
  document.body.append(canvas)
  const context = canvas.getContext('webgpu')
  context.configure({
    device,
    format: 'rgba16float',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    colorSpace: 'srgb',
    alphaMode: 'opaque',
    toneMapping: { mode: 'extended' }
  })
  const module = device.createShaderModule({
    code: `
    @group(0) @binding(0) var image: texture_external;
    @group(0) @binding(1) var imageSampler: sampler;
    struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f };
    @vertex fn vs(@builtin(vertex_index) index: u32) -> Vertex {
      let p = array(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3))[index];
      var result: Vertex;
      result.position = vec4f(p, 0, 1);
      result.uv = vec2f((p.x + 1) * 0.5, 1 - (p.y + 1) * 0.5);
      return result;
    }
    @fragment fn fs(input: Vertex) -> @location(0) vec4f {
      return textureSampleBaseClampToEdge(image, imageSampler, input.uv);
    }
  `
  })
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] }
  })
  const external = device.importExternalTexture({ source: frame, colorSpace: 'srgb' })
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: external },
      { binding: 1, resource: device.createSampler() }
    ]
  })
  const texture = context.getCurrentTexture()
  const buffer = device.createBuffer({
    size: 256 * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
  })
  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: texture.createView(),
        clearValue: [0, 0, 0, 1],
        loadOp: 'clear',
        storeOp: 'store'
      }
    ]
  })
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.draw(3)
  pass.end()
  encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow: 256 }, { width: 4, height: 4 })
  device.queue.submit([encoder.finish()])
  await buffer.mapAsync(GPUMapMode.READ)
  const view = new DataView(buffer.getMappedRange())
  const samples = [
    [0, 0],
    [3, 0],
    [0, 3],
    [3, 3]
  ].map(([x, y]) =>
    [0, 1, 2, 3].map((channel) => half(view.getUint16(y * 256 + x * 8 + channel * 2, true)))
  )
  buffer.unmap()
  const error = await device.popErrorScope()
  const configuration = context.getConfiguration()
  context.unconfigure()
  canvas.remove()
  buffer.destroy()
  device.destroy()
  if (error) throw new Error(error.message)
  return {
    supported: true,
    samples,
    format: configuration.format,
    toneMapping: configuration.toneMapping
  }
}

sharedTexture.setSharedTextureReceiver(async ({ importedSharedTexture }, index) => {
  const frame = importedSharedTexture.getVideoFrame()
  try {
    const webgpu = await inspectWebGpu(frame)
    send(`frame-${index}`, { format: frame.format, colorSpace: frame.colorSpace.toJSON(), webgpu })
  } catch (error) {
    ipcRenderer.send('display-probe', { key: `frame-${index}`, failure: String(error) })
  } finally {
    frame.close()
    importedSharedTexture.release()
  }
})
window.addEventListener('DOMContentLoaded', () =>
  send('ready', {
    webgpu: Boolean(navigator.gpu),
    mediaStreamTrackGenerator: typeof MediaStreamTrackGenerator === 'function',
    videoTrackGenerator: typeof VideoTrackGenerator === 'function',
    dynamicRangeHigh: matchMedia('(dynamic-range: high)').matches,
    videoDynamicRangeHigh: matchMedia('(video-dynamic-range: high)').matches
  })
)
