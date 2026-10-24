import { performance } from 'node:perf_hooks'
import { cpus, totalmem } from 'node:os'

const count = Number(process.argv[2])
const kind = process.argv[3]
const id = (index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
const refs = () => Array.from({ length: count }, (_, index) => ({ type: 'comic', id: id(index) }))
const scan = () => ({
  discovery: { finished: true, candidateCount: count, issues: [] },
  candidates: Array.from({ length: count }, (_, index) => ({
    path: `F:/fixture/漫画资料库/出版社/${String(index).padStart(8, '0')} 星屿系列第${index}部`,
    clues: { name: `星屿系列第${index}部` },
    result: {
      outcome: 'added',
      entry: { type: 'comic', id: id(index) },
      issues: []
    },
    localContent: { status: 'included' }
  }))
})
global.gc()
const baseline = process.memoryUsage()
let started = performance.now()
const value = kind === 'refs' ? refs() : scan()
const createMs = performance.now() - started
started = performance.now()
const json = JSON.stringify(value)
const stringifyMs = performance.now() - started
started = performance.now()
const parsed = JSON.parse(json)
const parseMs = performance.now() - started
started = performance.now()
const cloned = structuredClone(parsed)
const cloneMs = performance.now() - started
const peak = process.memoryUsage()
if (!cloned || !value) throw new Error('Fixture was not retained.')
process.stdout.write(
  JSON.stringify({
    node: process.version,
    cpu: cpus()[0].model,
    hostMemoryBytes: totalmem(),
    kind,
    count,
    jsonBytes: Buffer.byteLength(json),
    createMs,
    stringifyMs,
    parseMs,
    cloneMs,
    retainedHeapDeltaBytes: peak.heapUsed - baseline.heapUsed,
    rssDeltaBytes: peak.rss - baseline.rss,
    scope:
      'Synthetic Node JSON and structured-clone model; not Electron IPC or the production application.'
  }) + '\n'
)
