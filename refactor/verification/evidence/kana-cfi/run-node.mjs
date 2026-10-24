import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'
import { runCfiCases, fixtures } from './cases.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const cache = path.resolve(here, '../../../../node_modules/.cache')
const { default: factory } = await import(pathToFileURL(path.join(cache, 'kana-cfi/xml.mjs')))
const catalog = JSON.parse(await readFile(path.join(cache, 'kana-xml-input/catalog.json'), 'utf8'))
catalog.dtd = await readFile(path.join(cache, 'kana-xml-input/catalog.dtd'), 'utf8')
const hash = (value) => createHash('sha256').update(value).digest('hex')
const result = await runCfiCases(factory, catalog)
const report = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  sources: Object.fromEntries(
    await Promise.all(
      ['grammar.mjs', 'source.mjs', 'book.mjs', 'cases.mjs', 'run-node.mjs'].map(async (name) => [
        name,
        hash(await readFile(path.join(here, name)))
      ])
    )
  ),
  inputs: Object.fromEntries(
    await Promise.all(
      [
        'kana-cfi/xml.mjs',
        'kana-cfi/xml.wasm',
        'kana-xml-input/catalog.json',
        'kana-xml-input/catalog.dtd'
      ].map(async (name) => [name, hash(await readFile(path.join(cache, name)))])
    )
  ),
  fixtureHashes: Object.fromEntries([...fixtures].map(([name, value]) => [name, hash(value)])),
  ...result
}
await writeFile(path.join(here, 'node-contract.json'), JSON.stringify(report, null, 2) + '\n')
process.stdout.write(
  JSON.stringify({
    grammar: result.grammar.length,
    source: result.source.length,
    endpoints: result.savedTextEndpoints,
    restores: result.reopenedEndpoints
  }) + '\n'
)
