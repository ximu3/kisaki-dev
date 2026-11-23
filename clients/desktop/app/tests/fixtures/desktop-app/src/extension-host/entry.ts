import type {} from 'electron'

process.parentPort.on('message', () => process.exit(0))
process.parentPort.postMessage({ type: 'fixture-worker-ready' })
