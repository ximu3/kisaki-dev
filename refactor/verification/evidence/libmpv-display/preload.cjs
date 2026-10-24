const { ipcRenderer, sharedTexture } = require('electron')
const send = (key, value) => ipcRenderer.send('display-probe', { key, value })

function inspectCanvas(source, colorSpace) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 4
  document.body.append(canvas)
  const context = canvas.getContext('2d', {
    alpha: false,
    colorSpace,
    colorType: 'float16',
    toneMapping: { mode: 'extended' }
  })
  try {
    context.imageSmoothingEnabled = false
    context.drawImage(source, 0, 0, 4, 4)
    const pixels = context.getImageData(0, 0, 4, 4, {
      colorSpace,
      pixelFormat: 'rgba-float16'
    })
    return {
      attributes: context.getContextAttributes(),
      pixelFormat: pixels.pixelFormat,
      samples: [0, 3, 12, 15].map((index) =>
        Array.from(pixels.data.slice(index * 4, index * 4 + 4))
      )
    }
  } finally {
    canvas.width = canvas.height = 0
    canvas.remove()
  }
}

async function inspectVideo(frame) {
  if (typeof MediaStreamTrackGenerator !== 'function') return { supported: false }
  const track = new MediaStreamTrackGenerator({ kind: 'video' })
  const writer = track.writable.getWriter()
  const video = document.createElement('video')
  video.muted = true
  video.autoplay = true
  video.playsInline = true
  video.width = 128
  video.height = 96
  video.style.cssText =
    'position: absolute; left: 16px; top: 16px; width: 128px; height: 96px; object-fit: fill'
  document.body.append(video)
  video.srcObject = new MediaStream([track])
  let callbackId
  let timeout
  let stopped = false
  let feeding
  try {
    const presented = new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Video frame callback timed out.')), 6000)
      callbackId = video.requestVideoFrameCallback((now, metadata) => resolve({ now, metadata }))
    })
    const playback = video.play()
    send('stage', 'Writing video reference.')
    feeding = (async () => {
      for (let index = 0; index < 160 && !stopped; index++) {
        await writer.write(new VideoFrame(frame, { timestamp: index * 50000 }))
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    })()
    send('stage', 'Waiting for video reference.')
    const [, callback] = await Promise.all([playback, presented])
    send('stage', 'Video reference arrived.')
    const snapshot = new VideoFrame(video)
    try {
      const rect = video.getBoundingClientRect()
      const points = [
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75]
      ].map(([x, y]) => [
        (rect.left + rect.width * x) / innerWidth,
        (rect.top + rect.height * y) / innerHeight
      ])
      points.push([176 / innerWidth, 32 / innerHeight])
      const compositor = await ipcRenderer.invoke('capture-display', points)
      return {
        supported: true,
        callback,
        readyState: video.readyState,
        dimensions: [video.videoWidth, video.videoHeight],
        colorSpace: snapshot.colorSpace.toJSON(),
        compositor,
        srgbCanvas: inspectCanvas(video, 'srgb'),
        p3Canvas: inspectCanvas(video, 'display-p3')
      }
    } finally {
      snapshot.close()
    }
  } finally {
    stopped = true
    await feeding
    clearTimeout(timeout)
    video.cancelVideoFrameCallback(callbackId)
    send('stage', 'Closing video writer.')
    await writer.close()
    writer.releaseLock()
    track.stop()
    video.pause()
    const emptied = new Promise((resolve) =>
      video.addEventListener('emptied', resolve, { once: true })
    )
    video.srcObject = null
    video.load()
    await emptied
    video.remove()
    send('stage', 'Video writer closed.')
  }
}

sharedTexture.setSharedTextureReceiver(async ({ importedSharedTexture }, index) => {
  const frame = importedSharedTexture.getVideoFrame()
  let result
  let failure
  try {
    send('stage', 'Inspecting Canvas reference.')
    const srgbCanvas = inspectCanvas(frame, 'srgb')
    const p3Canvas = inspectCanvas(frame, 'display-p3')
    const video = await inspectVideo(frame)
    result = {
      format: frame.format,
      colorSpace: frame.colorSpace.toJSON(),
      srgbCanvas,
      p3Canvas,
      video
    }
  } catch (error) {
    failure = String(error)
  } finally {
    frame.close()
    importedSharedTexture.release()
  }
  if (failure) ipcRenderer.send('display-probe', { key: `frame-${index}`, failure })
  else send(`frame-${index}`, result)
})
window.addEventListener('DOMContentLoaded', () => {
  document.body.replaceChildren()
  const white = document.createElement('div')
  white.style.cssText =
    'position: absolute; left: 160px; top: 16px; width: 32px; height: 32px; background: white'
  document.body.append(white)
  send('ready', {
    mediaStreamTrackGenerator: typeof MediaStreamTrackGenerator === 'function',
    dynamicRangeHigh: matchMedia('(dynamic-range: high)').matches,
    videoDynamicRangeHigh: matchMedia('(video-dynamic-range: high)').matches
  })
})
