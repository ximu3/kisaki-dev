// Run the fixed Wasm candidate without registering a production dependency.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { runCodecCases } from './cases.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-xml-codecs')
const { default: codecFactory } = await import(pathToFileURL(path.join(cache, 'build/codec.mjs')))
const { default: xmlFactory } = await import(pathToFileURL(path.join(cache, 'build/xml.mjs')))
const { default: originalFactory } = await import(
  pathToFileURL(path.join(cache, 'build/codec-original.mjs'))
)
const fixtures = await readFile(path.join(cache, 'fixtures.json'))
const original = await runCodecCases(
  originalFactory,
  xmlFactory,
  JSON.parse(fixtures),
  new Set(['CP932'])
)
const results = await runCodecCases(codecFactory, xmlFactory, JSON.parse(fixtures))
const hash = (value) => createHash('sha256').update(value).digest('hex')
const wasm = await readFile(path.join(cache, 'build/codec.wasm'))
const report = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  sources: Object.fromEntries(
    await Promise.all(
      ['cases.mjs', 'convert.mjs', 'run-node.mjs'].map(async (name) => [
        name,
        hash(await readFile(path.join(here, name)))
      ])
    )
  ),
  inputs: {
    fixturesSha256: hash(fixtures),
    codecWasmSha256: hash(wasm),
    originalCodecWasmSha256: hash(await readFile(path.join(cache, 'build/codec-original.wasm'))),
    xmlWasmSha256: hash(await readFile(path.join(cache, 'build/xml.wasm')))
  },
  candidateSize: { wasmBytes: wasm.length, wasmGzipBytes: gzipSync(wasm).length },
  originalCandidate: {
    cp932: original.cp932,
    cases: original.cases,
    comparisons: original.comparisons
  },
  ...results
}
await writeFile(path.join(here, 'node-contract.json'), JSON.stringify(report, null, 2) + '\n')
process.stdout.write(
  JSON.stringify({
    cases: results.cases.length,
    attempts: results.cases.reduce((sum, item) => sum + item.attempts.length, 0),
    failures: results.failures.length,
    comparisons: results.comparisons,
    size: report.candidateSize
  }) + '\n'
)
