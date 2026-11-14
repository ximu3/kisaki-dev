/** @fileoverview Runs the full synthetic storage workload and writes its report from a dedicated Electron worker. */

import { workerData } from 'node:worker_threads'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { measureStorage } from './measurement'

/** Isolated profile and prepared resources supplied by the performance test. */
const { profile, resources } = workerData as { profile: string; resources: string }

/** Completed workload including index rebuilds, query plans and environment. */
const report = await measureStorage(profile, resources)
await writeFile(join(profile, 'storage-performance.json'), JSON.stringify(report, null, 2))
