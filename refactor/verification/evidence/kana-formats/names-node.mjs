// Check derived raw names, source Unicode names, and encrypted-header hook placement.
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { readNames, admitName } from './names-parser.mjs'
const [cache, oldCache, output] = process.argv.slice(2)
const { default: factory } = await import(
  pathToFileURL(path.resolve(cache, 'names-build/unrar.mjs'))
)
const inputs = JSON.parse(
  await readFile(new URL('./names-fixture-input.json', import.meta.url), 'utf8')
)
const runs = []
for (const item of inputs.cases) {
  const names = await readNames(factory, await readFile(path.join(cache, 'names', item.name)))
  const result = names[0]
  if (
    names.length !== 1 ||
    result.admitted.name !== (item.expected ?? undefined) ||
    result.admitted.failure !== (item.reason ?? undefined) ||
    JSON.stringify(result.original.bytes) !== JSON.stringify(item.sourceBytes)
  )
    throw new Error('Source name interpretation differs: ' + item.name)
  runs.push({ name: item.name, names })
}
for (const name of [
  'test_read_format_rar_unicode.rar',
  'test_read_format_rar5_unicode.rar',
  'test_read_format_rar4_solid_encrypted_filenames.rar',
  'test_read_format_rar5_solid_encrypted_filenames.rar'
]) {
  const names = await readNames(
    factory,
    await readFile(path.join(oldCache, 'fixtures', name)),
    name.includes('encrypted') ? 'password' : ''
  )
  for (const entry of names)
    if (entry.admitted.failure) {
      if (
        name !== 'test_read_format_rar_unicode.rar' ||
        entry.admitted.failure !== 'legacyEncodingRequired'
      )
        throw new Error('Known Unicode name failed: ' + name)
      entry.explicitUtf8 = admitName(entry.original, 'utf-8')
      if (entry.explicitUtf8.name !== 'abcdefghijklmnopqrsテスト.txt')
        throw new Error('Explicit legacy encoding differs')
    }
  runs.push({ name, names })
}
const oemMaps = JSON.parse(await readFile(path.join(cache, 'oem-maps.json'), 'utf8'))
const legacyNames = await readNames(
  factory,
  await readFile(path.join(cache, 'names/legacy-cp437.rar'))
)
const legacy = legacyNames.find((entry) => entry.original.bytes.includes(0x82))
if (!legacy || legacy.admitted.failure !== 'legacyEncodingRequired')
  throw new Error('Legacy encoding ambiguity was lost')
legacy.cp437 = admitName(legacy.original, 'ibm437', oemMaps)
legacy.windows1252 = admitName(legacy.original, 'windows-1252', oemMaps)
if (legacy.cp437.name !== 'café.txt' || legacy.windows1252.name !== 'caf‚.txt')
  throw new Error('Explicit legacy decoding differs')
const native1252 = new TextDecoder('windows-1252').decode(Uint8Array.of(0x80, 0x82))
const malformed = await readNames(
  factory,
  await readFile(path.join(cache, 'names/invalid-legacy-unicode.rar'))
)
const malformedUnicode = malformed.find((entry) => entry.admitted.failure === 'invalidEncoding')
if (!malformedUnicode || malformedUnicode.dllName !== 'A')
  throw new Error('Malformed Unicode repair was not rejected')
await writeFile(
  output,
  JSON.stringify(
    {
      runs,
      malformedUnicode,
      legacy,
      node: process.versions.node,
      nativeWindows1252CodePoints: [...native1252].map((value) => value.codePointAt(0)),
      fixedWindows1252CodePoints: [oemMaps['windows-1252'][0x80], oemMaps['windows-1252'][0x82]],
      candidateOnly: true,
      allAssertionsPassed: true,
      fullLegacyEncodingPolicyChosen: false
    },
    null,
    2
  ) + '\n'
)
process.stdout.write(
  JSON.stringify({
    archives: runs.length,
    members: runs.reduce((sum, item) => sum + item.names.length, 0)
  }) + '\n'
)
