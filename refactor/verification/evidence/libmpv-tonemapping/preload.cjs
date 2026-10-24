const { ipcRenderer, sharedTexture } = require('electron')
const send = (key, value) => ipcRenderer.send('mapping-probe', { key, value })

async function present(frame) {
  const track = new MediaStreamTrackGenerator({ kind: 'video' })
  const writer = track.writable.getWriter()
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.style.cssText =
    'position:absolute;left:16px;top:16px;width:224px;height:96px;object-fit:fill'
  document.body.append(video)
  video.srcObject = new MediaStream([track])
  let feeding
  let stopped = false
  let timeout
  let callbackId
  try {
    const presented = new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Video reference timed out.')), 6000)
      let received = 0
      const accept = (now, metadata) => {
        if (++received >= 3) resolve({ now, metadata })
        else callbackId = video.requestVideoFrameCallback(accept)
      }
      callbackId = video.requestVideoFrameCallback(accept)
    })
    const playback = video.play()
    feeding = (async () => {
      for (let index = 0; index < 160 && !stopped; index++) {
        await writer.write(new VideoFrame(frame, { timestamp: index * 50000 }))
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    })()
    const [, callback] = await Promise.all([playback, presented])
    const rect = video.getBoundingClientRect()
    const points = Array.from({ length: 7 }, (_, index) => [
      (rect.left + (rect.width * (index + 0.5)) / 7) / innerWidth,
      (rect.top + rect.height * 0.5) / innerHeight
    ])
    points.push([272 / innerWidth, 32 / innerHeight])
    const compositor = await ipcRenderer.invoke('capture-mapping', points)
    const snapshot = new VideoFrame(video)
    const deliveredColorSpace = snapshot.colorSpace.toJSON()
    snapshot.close()
    return {
      callback,
      compositor,
      deliveredColorSpace,
      colorSpace: frame.colorSpace.toJSON(),
      format: frame.format
    }
  } finally {
    stopped = true
    await feeding
    clearTimeout(timeout)
    video.cancelVideoFrameCallback(callbackId)
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
  }
}

sharedTexture.setSharedTextureReceiver(async ({ importedSharedTexture }, index) => {
  const frame = importedSharedTexture.getVideoFrame()
  let result
  let failure
  try {
    result = await present(frame)
  } catch (error) {
    failure = String(error)
  } finally {
    frame.close()
    importedSharedTexture.release()
  }
  if (failure) ipcRenderer.send('mapping-probe', { key: `frame-${index}`, failure })
  else send(`frame-${index}`, result)
})
window.addEventListener('DOMContentLoaded', () => {
  document.body.replaceChildren()
  const white = document.createElement('div')
  white.style.cssText =
    'position:absolute;left:256px;top:16px;width:32px;height:32px;background:white'
  document.body.append(white)
  send('ready', {})
})
