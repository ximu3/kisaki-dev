// Run the source CFI graph cases with the same XML candidate used by the browser worker.
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { runCfiCases } from './cfi-cases.mjs'
const [cache, output] = process.argv.slice(2)
const { default: factory } = await import(pathToFileURL(path.resolve(cache, 'xml-build/expat.mjs')))
const inputs = JSON.parse(await readFile(path.join(cache, 'epub-documents.json'), 'utf8'))
const result = await runCfiCases(
  factory,
  new Map(Object.entries(inputs).map(([name, text]) => [name, new TextEncoder().encode(text)]))
)
await writeFile(output, JSON.stringify(result, null, 2) + '\n')
process.stdout.write(JSON.stringify({ cases: result.cases.length, passed: true }) + '\n')
