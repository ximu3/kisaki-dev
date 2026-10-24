import { parentPort, workerData } from 'node:worker_threads'
import { ProbePlayer } from './provider.mjs'

const { addonPath, dllPath, operation, cleanupMarker } = workerData
const block = () => {
  parentPort.postMessage(operation)
  if (operation === 'natural-open') {
    clearInterval(player.poller)
    parentPort.close()
  }
  return new Promise(() => {})
}
const player = new ProbePlayer(addonPath, dllPath, {
  open() {
    if (operation === 'open' || operation === 'natural-open') return block()
    return {
      read: block,
      close() {
        Atomics.add(new Int32Array(cleanupMarker), 0, 1)
      }
    }
  },
  onError() {
    throw new Error('Unexpected worker probe failure.')
  }
})
player.load()
