// Preserve counterexamples to the earlier, deliberately partial provenance probe.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createMarkupMapper } from '../kana-formats/markup-map.mjs'
import { markupCases, chunks } from './cases.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const dependency = await import(
  pathToFileURL(path.join(root, 'node_modules/.cache/kana-formats/parse5.mjs'))
)
const maps = JSON.parse(
  await readFile(path.join(root, 'node_modules/.cache/kana-xml-input/encoding-maps.json'), 'utf8')
)
const parse = createMarkupMapper(dependency, maps)
const cases = []
for (const fixture of markupCases) {
  const attempts = []
  for (const chunk of chunks) {
    try {
      const result = parse(new TextEncoder().encode(fixture.source), 'utf-8', chunk)
      attempts.push({ chunk, parsed: true, units: result.units.length })
    } catch (error) {
      attempts.push({ chunk, parsed: false, diagnostic: error.message })
    }
  }
  cases.push({ name: fixture.name, attempts })
}
const hash = async (file) =>
  createHash('sha256')
    .update(await readFile(file))
    .digest('hex')
const result = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  purpose:
    'Audit the recorded partial probe; failures do not describe a shipped Kana implementation.',
  sources: {
    '../kana-formats/markup-map.mjs': await hash(path.join(here, '../kana-formats/markup-map.mjs')),
    'cases.mjs': await hash(path.join(here, 'cases.mjs')),
    'baseline.mjs': await hash(path.join(here, 'baseline.mjs'))
  },
  cases
}
await writeFile(path.join(here, 'baseline-contract.json'), JSON.stringify(result, null, 2) + '\n')
process.stdout.write(
  JSON.stringify({
    cases: cases.length,
    failedCases: cases
      .filter((item) => item.attempts.some((attempt) => !attempt.parsed))
      .map((item) => item.name)
  }) + '\n'
)
