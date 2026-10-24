import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

// Packages only the checked-in synthetic records and synthetic image bytes.
if (!process.argv[2]) throw new Error('Pass the fflate 0.8.3 ESM module path.')
const { zipSync } = await import(pathToFileURL(resolve(process.argv[2])).href)
const root = dirname(fileURLToPath(import.meta.url))
const names = [
  'data.galgames.json',
  'data.galgameSources.json',
  'data.categoryGroups.json',
  'data.staff.json',
  'data.dataStatus.json',
  'data.pageSettings.json'
]
const entries = Object.fromEntries(
  names.map((name) => [name, readFileSync(join(root, 'fixture', name))])
)
const picture = readFileSync(join(root, 'meta-v2', 'cover.png'))
for (const name of [
  'cover',
  'header',
  'character',
  'character-preview',
  'library',
  'category',
  'staff'
])
  entries['Images/' + name + '.png'] = picture
const archive = zipSync(entries, { level: 6, mtime: new Date('2026-10-17T00:00:00Z') })
writeFileSync(join(root, 'synthetic.pvnExport.zip'), archive)
console.log(
  JSON.stringify({
    bytes: archive.length,
    sha256: createHash('sha256').update(archive).digest('hex')
  })
)
