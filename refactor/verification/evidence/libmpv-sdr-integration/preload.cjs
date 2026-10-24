// Read explicit canvas color spaces and retain frames through their actual release.
const { ipcRenderer, sharedTexture } = require('electron')
const held = new Map()
const send = (key, value) => ipcRenderer.send('result', { key, value })
function sample(frame, colorSpace, points) {
  const canvas = document.createElement('canvas')
  canvas.width = frame.displayWidth
  canvas.height = frame.displayHeight
  const context = canvas.getContext('2d', { colorSpace, willReadFrequently: true })
  if (context.getContextAttributes().colorSpace !== colorSpace)
    throw new Error('Canvas color space was not adopted.')
  context.drawImage(frame, 0, 0)
  return points.map(([x, y]) => [
    ...context.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1, {
      colorSpace
    }).data
  ])
}
sharedTexture.setSharedTextureReceiver(async ({ importedSharedTexture }, index, points) => {
  try {
    const frame = importedSharedTexture.getVideoFrame()
    const clone = frame.clone()
    held.set(index, { frame, clone, points })
    const result = {
      srgb: sample(frame, 'srgb', points),
      p3: sample(frame, 'display-p3', points),
      colorSpace: frame.colorSpace.toJSON()
    }
    importedSharedTexture.release()
    send('received-' + index, result)
  } catch (error) {
    ipcRenderer.send('result', { key: 'received-' + index, error: String(error) })
  }
})
ipcRenderer.on('close-first', (_event, index) => {
  const item = held.get(index)
  item.frame.close()
  sample(item.clone, 'srgb', item.points)
  send('first-' + index, true)
})
ipcRenderer.on('close-last', (_event, index) => {
  held.get(index).clone.close()
  held.delete(index)
  send('last-' + index, true)
})
window.addEventListener('DOMContentLoaded', () => send('ready', true))
