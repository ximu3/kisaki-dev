const { ipcRenderer, sharedTexture } = require('electron')
const held = new Map()
const send = (key, value) => ipcRenderer.send('probe-result', { key, value })

function sample(frame, target) {
  const canvas = document.createElement('canvas')
  canvas.width = frame.displayWidth
  canvas.height = frame.displayHeight
  const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true })
  context.drawImage(frame, 0, 0)
  const samples = [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75]
  ].map(([x, y]) => [
    ...context.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data
  ])
  const expected = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 255, 255]
  ]
  if (target === 'pq') {
    const [red, green, blue, white] = samples
    if (!(
      red[0] > red[1] + 30 &&
      red[0] > red[2] + 30 &&
      green[1] > green[0] + 30 &&
      green[1] > green[2] + 30 &&
      blue[2] > blue[0] + 30 &&
      blue[2] > blue[1] + 30 &&
      Math.abs(white[0] - white[1]) <= 2 &&
      Math.abs(white[0] - white[2]) <= 2 &&
      samples.every((pixel) => pixel[3] === 255)
    )) {
      throw new Error(`Unexpected HDR probe pixels: ${JSON.stringify(samples)}`)
    }
  } else if (
    !samples.every((pixel, index) =>
      pixel.every((channel, component) => Math.abs(channel - expected[index][component]) <= 1)
    )
  ) {
    throw new Error(`Unexpected probe pixels: ${JSON.stringify(samples)}`)
  }
  canvas.width = canvas.height = 1
  return samples
}

sharedTexture.setSharedTextureReceiver(async ({ importedSharedTexture }, index, target) => {
  try {
    const frame = importedSharedTexture.getVideoFrame()
    const clone = frame.clone()
    held.set(index, { frame, clone, target })
    const samples = sample(frame, target)
    importedSharedTexture.release()
    send(`received-${index}`, { format: frame.format, samples, timestamp: frame.timestamp })
  } catch (error) {
    ipcRenderer.send('probe-result', { key: `received-${index}`, failure: String(error) })
  }
})

ipcRenderer.on('probe-close-first', (_event, index) => {
  const { frame, clone, target } = held.get(index)
  frame.close()
  sample(clone, target)
  send(`first-closed-${index}`, true)
})
ipcRenderer.on('probe-close-last', (_event, index) => {
  held.get(index).clone.close()
  held.delete(index)
  send(`last-closed-${index}`, true)
})
window.addEventListener('DOMContentLoaded', () => send('ready', true))
