const { ipcRenderer, sharedTexture } = require('electron')
let currentRun = 0
let currentToken = 0
let acceptedFrame = null
const held = new Map()
const jobs = new Set()
const delayedJobs = new Set()
const send = (key, value) => ipcRenderer.send('handoff-result', { key, value })
const sample = (frame) => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 48
  const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true })
  context.drawImage(frame, 0, 0)
  const pixel = [...context.getImageData(32, 24, 1, 1).data]
  canvas.width = canvas.height = 1
  return pixel
}
ipcRenderer.on('handoff-epoch', (_event, { run, token }) => {
  currentRun = run
  currentToken = token
  for (const pending of delayedJobs) {
    if (pending.run !== run || pending.token !== token) pending.resolve()
  }
  send(`epoch-${run}-${token}`, true)
})
sharedTexture.setSharedTextureReceiver(({ importedSharedTexture }, packet) => {
  const work = (async () => {
    const frame = importedSharedTexture.getVideoFrame()
    importedSharedTexture.release()
    let clone
    try {
      if (packet.delayed) {
        let resume
        const wait = new Promise((resolve) => {
          resume = resolve
        })
        const pending = { run: packet.run, token: packet.token, resolve: resume }
        delayedJobs.add(pending)
        send('entered', packet.id)
        await wait
        delayedJobs.delete(pending)
      }
      const accepted = packet.run === currentRun && packet.token === currentToken
      const before = acceptedFrame
      // Admission is decided before inspecting pixels; this canvas is a test oracle.
      const pixel = sample(frame)
      if (accepted) acceptedFrame = { run: packet.run, token: packet.token, sample: pixel }
      let retained = false
      if (accepted && packet.token === 1 && !held.has(packet.run)) {
        clone = frame.clone()
        held.set(packet.run, clone)
        retained = true
      }
      frame.close()
      send(`received-${packet.id}`, {
        accepted,
        delayed: packet.delayed,
        retained,
        sample: pixel,
        consumerStateBefore: before,
        consumerStateAfter: acceptedFrame
      })
    } catch (error) {
      frame.close()
      clone?.close()
      ipcRenderer.send('handoff-result', { key: `received-${packet.id}`, failure: String(error) })
    }
  })()
  jobs.add(work)
  work.finally(() => jobs.delete(work))
  return work
})
ipcRenderer.on('handoff-close-held', (_event, run) => {
  const frame = held.get(run)
  if (!frame) {
    ipcRenderer.send('handoff-result', { key: `held-${run}`, failure: 'Missing held frame.' })
    return
  }
  const pixel = sample(frame)
  frame.close()
  held.delete(run)
  send(`held-${run}`, { sample: pixel })
})
ipcRenderer.on('handoff-dispose', async (_event, run) => {
  for (const pending of delayedJobs) pending.resolve()
  await Promise.allSettled(jobs)
  held.get(run)?.close()
  held.delete(run)
  send(`dispose-${run}`, true)
})
window.addEventListener('DOMContentLoaded', () => send('ready', true))
