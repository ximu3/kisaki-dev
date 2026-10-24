// Run the same XML cases outside Chromium before exercising the browser worker.
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { runXmlCases } from './xml-cases.mjs'

const [cache, sourceCache, output] = process.argv.slice(2)
const { default: factory } = await import(pathToFileURL(path.resolve(cache, 'xml-build/expat.mjs')))
const fixtures = JSON.parse(await readFile(path.join(sourceCache, 'fixtures.json'), 'utf8')).cases
const maps = JSON.parse(await readFile(path.join(cache, 'oem-maps.json'), 'utf8'))
const result = await runXmlCases(
  factory,
  fixtures,
  (name) => readFile(path.join(sourceCache, 'fixtures', name)),
  maps
)
await writeFile(output, JSON.stringify(result, null, 2) + '\n')
process.stdout.write(
  JSON.stringify({
    normal: result.normal.length,
    cases: result.cases.length,
    memoryBytes: result.memoryBytes
  }) + '\n'
)
