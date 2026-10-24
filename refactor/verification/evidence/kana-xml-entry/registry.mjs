// Generate a finite alias registry from the fixed converter, excluding machine representations.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { createConverter, CodecFailure } from '../kana-xml-codecs/convert.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const build = path.join(root, 'node_modules/.cache/kana-xml-entry/build')
const { default: factory } = await import(pathToFileURL(path.join(build, 'codec.mjs')))
const labels = {}
const excluded = []
const internal = new Set([
  'CHAR',
  'WCHAR_T',
  'UCS-2-INTERNAL',
  'UCS-2-SWAPPED',
  'UCS-4-INTERNAL',
  'UCS-4-SWAPPED'
])
const module = await factory({
  codecName(alias, canonical) {
    if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(alias) || internal.has(canonical)) {
      excluded.push({ alias, canonical })
      return
    }
    labels[alias.toLowerCase()] = canonical
  }
})
module._kana_codec_list()
const convert = createConverter(module)
const sample = '<?xml version="1.0" encoding="Ascii_Name-1.2" standalone="yes"?>'
const unicode = /^(?:UTF-(?:8|16|32)|UCS-[24])(?:BE|LE)?$/
const supported = new Set()
for (const canonical of new Set(Object.values(labels))) {
  if (unicode.test(canonical)) {
    supported.add(canonical)
    continue
  }
  if (['C99', 'JAVA'].includes(canonical)) continue
  let actual = ''
  try {
    await convert([new TextEncoder().encode(sample)], canonical, (bytes) => {
      actual += new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    })
  } catch (error) {
    if (!(error instanceof CodecFailure)) throw error
  }
  if (actual === sample) supported.add(canonical)
}
for (const [alias, canonical] of Object.entries(labels)) {
  if (!supported.has(canonical)) {
    excluded.push({ alias, canonical, reason: 'not an accepted self-describing XML encoding' })
    delete labels[alias]
  }
}
const sorted = Object.fromEntries(
  Object.entries(labels).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
)
const result = {
  libiconv: '1.19',
  labels: sorted,
  canonical: [...new Set(Object.values(sorted))].sort(),
  excluded
}
await writeFile(path.join(build, 'registry.json'), JSON.stringify(result, null, 2) + '\n')
const report = {
  checkedAt: new Date().toISOString(),
  aliases: Object.keys(sorted).length,
  canonical: result.canonical,
  excluded,
  scriptSha256: createHash('sha256')
    .update(await readFile(fileURLToPath(import.meta.url)))
    .digest('hex'),
  registrySha256: createHash('sha256')
    .update(await readFile(path.join(build, 'registry.json')))
    .digest('hex')
}
await writeFile(path.join(here, 'registry-contract.json'), JSON.stringify(report, null, 2) + '\n')
process.stdout.write(
  JSON.stringify({
    aliases: report.aliases,
    canonical: report.canonical.length,
    excluded: excluded.length
  }) + '\n'
)
