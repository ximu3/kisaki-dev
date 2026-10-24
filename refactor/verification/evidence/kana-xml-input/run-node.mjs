// Record parser observations without interpreting them as complete reader conformance.
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { createParser } from './parser.mjs'
import { compare, checkCatalog } from './compare.mjs'
import { boundaries, checkFb2 } from './boundaries.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-xml-input')
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(cache, name), 'utf8'))
const modules = await import(pathToFileURL(path.join(cache, 'candidates.mjs')))
const { default: factory } = await import(pathToFileURL(path.join(cache, 'expat/expat.mjs')))
const parser = await createParser(
  factory,
  await readJson('catalog.json'),
  await readJson('encoding-maps.json')
)
const namedEntities = await readJson('entities.json')
const comparison = await compare(modules, parser, namedEntities)
const catalog = checkCatalog(parser, namedEntities)
const byteAndBudget = boundaries(parser)
const sourceCache = path.join(root, 'node_modules/.cache/kana-source')
const fb2Fixtures = JSON.parse(await fs.readFile(path.join(sourceCache, 'fixtures.json'), 'utf8'))
const fb2 = await checkFb2(
  parser,
  fb2Fixtures.cases,
  async (name) => new Uint8Array(await fs.readFile(path.join(sourceCache, 'fixtures', name)))
)
const sourceHashes = {}
for (const name of [
  'parser.mjs',
  'cases.mjs',
  'compare.mjs',
  'boundaries.mjs',
  'run-node.mjs',
  'source-input.json',
  'build-contract.json'
])
  sourceHashes[name] = crypto
    .createHash('sha256')
    .update(await fs.readFile(path.join(here, name)))
    .digest('hex')
const record = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  candidateOnly: true,
  readerImplementationExecuted: false,
  comparison,
  catalog,
  byteAndBudget,
  fb2,
  fb2ReceiptSha256: crypto
    .createHash('sha256')
    .update(await fs.readFile(path.join(here, '../kana-source/fixture-input.json')))
    .digest('hex'),
  nativeHeapBytes: parser.memoryBytes,
  sourceHashes
}
await fs.writeFile(path.join(here, 'node-contract.json'), JSON.stringify(record, null, 2) + '\n')
console.log(
  JSON.stringify({
    candidates: Object.fromEntries(
      Object.entries(comparison).map(([key, value]) => [
        key,
        { matched: value.matched, total: value.comparisons }
      ])
    ),
    catalog,
    boundaryComparisons: byteAndBudget.comparisons,
    fb2Comparisons: fb2.length
  })
)
