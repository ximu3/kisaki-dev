import { parentPort, workerData } from 'node:worker_threads'
import { measureStorage, type StorageMeasurementInput } from './measurement'

const report = await measureStorage(workerData as StorageMeasurementInput)
parentPort!.postMessage(JSON.stringify(report, null, 2))
