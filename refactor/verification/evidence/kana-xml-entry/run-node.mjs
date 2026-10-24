// Run the entry with real Wasm decoders and the generated, immutable alias profile.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { runEntryCases } from './cases.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const cache = path.join(root, 'node_modules/.cache')
const build = path.join(cache, 'kana-xml-entry/build')
const { default: xmlFactory } = await import(pathToFileURL(path.join(build, 'xml.mjs')))
const { default: codecFactory } = await import(pathToFileURL(path.join(build, 'codec.mjs')))
const json = async (file) => JSON.parse(await readFile(file, 'utf8'))
const registry = await json(path.join(build, 'registry.json'))
const catalog = await json(path.join(cache, 'kana-xml-input/catalog.json'))
catalog.dtd = await readFile(path.join(cache, 'kana-xml-input/catalog.dtd'), 'utf8')
const fixtures = await json(path.join(cache, 'kana-xml-entry/fixtures.json'))
const result = await runEntryCases(xmlFactory, codecFactory, registry, catalog, fixtures)
const hash = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex')
const report = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  sources: Object.fromEntries(
    await Promise.all(
      ['input.mjs', 'cases.mjs', 'run-node.mjs'].map(async (name) => [
        name,
        await hash(path.join(here, name))
      ])
    )
  ),
  inputs: Object.fromEntries(
    await Promise.all(
      [
        'kana-xml-entry/build/xml.mjs',
        'kana-xml-entry/build/xml.wasm',
        'kana-xml-entry/build/codec.mjs',
        'kana-xml-entry/build/codec.wasm',
        'kana-xml-entry/build/registry.json',
        'kana-xml-entry/fixtures.json',
        'kana-xml-input/catalog.json',
        'kana-xml-input/catalog.dtd'
      ].map(async (name) => [name, await hash(path.join(cache, name))])
    )
  ),
  converterSha256: await hash(path.join(here, '../kana-xml-codecs/convert.mjs')),
  ...result
}
await writeFile(path.join(here, 'node-contract.json'), JSON.stringify(report, null, 2) + '\n')
process.stdout.write(
  JSON.stringify({
    cases: result.cases.length,
    attempts: result.cases.reduce((sum, item) => sum + item.attempts.length, 0),
    extra: result.extra.length,
    aliases: result.registryAliases,
    codecModuleLoads: result.codecModuleLoads
  }) + '\n'
)
