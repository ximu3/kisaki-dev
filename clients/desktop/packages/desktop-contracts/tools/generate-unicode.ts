/** @fileoverview Derives the pinned Unicode tables used for desktop name ordering from verified UCD inputs. */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runCli } from '@kisaki3/tooling/cli'
import inputs from '../assets/unicode/18.0.0/inputs.json'

const project = join(import.meta.dirname, '..')

/** Generate deterministic plain tables from retained official bytes; no download or host Unicode data is used. */
export async function generateUnicodeTables(): Promise<string> {
  const files = new Map<string, string>()
  for (const [name, digest] of Object.entries(inputs.files)) {
    const bytes = await readFile(join(project, 'assets/unicode/18.0.0', name))
    if (createHash('sha256').update(bytes).digest('hex') !== digest) {
      throw new Error(`Unicode input digest mismatch: ${name}`)
    }
    files.set(name, bytes.toString('utf8'))
  }

  const exclusions = new Set<number>()
  for (const line of files.get('DerivedNormalizationProps.txt')!.split(/\r?\n/)) {
    const fields = line
      .split('#')[0]!
      .split(';')
      .map((field) => field.trim())
    if (fields[1] !== 'Full_Composition_Exclusion') {
      continue
    }

    const [start, end = start] = fields[0]!.split('..').map((point) => Number.parseInt(point, 16))
    for (let point = start!; point <= end!; point += 1) {
      exclusions.add(point)
    }
  }

  const combining: Record<number, number> = {}
  const decomposition: Record<number, number[]> = {}
  const canonicalDecomposition: Record<number, number[]> = {}
  const composition: Record<string, number> = {}
  const digits: Record<number, number> = {}
  const folding: Record<number, number[]> = {}
  for (const line of files.get('UnicodeData.txt')!.split(/\r?\n/)) {
    if (!line) {
      continue
    }

    const fields = line.split(';')
    const point = Number.parseInt(fields[0]!, 16)
    if (fields[3] !== '0') {
      combining[point] = Number(fields[3])
    }
    if (fields[2] === 'Nd') {
      digits[point] = Number(fields[6])
    }

    if (fields[5]) {
      const mapping = fields[5]
        .replace(/^<[^>]+> /, '')
        .split(' ')
        .map((value) => Number.parseInt(value, 16))
      decomposition[point] = mapping
      if (!fields[5].startsWith('<')) {
        canonicalDecomposition[point] = mapping
      }
      if (!fields[5].startsWith('<') && mapping.length === 2 && !exclusions.has(point)) {
        composition[`${mapping[0]},${mapping[1]}`] = point
      }
    }
  }

  for (const line of files.get('CaseFolding.txt')!.split(/\r?\n/)) {
    const fields = line
      .split('#')[0]!
      .split(';')
      .map((field) => field.trim())
    if (fields[1] === 'C' || fields[1] === 'F') {
      folding[Number.parseInt(fields[0]!, 16)] = fields[2]!
        .split(' ')
        .map((value) => Number.parseInt(value, 16))
    }
  }

  const tables = [
    ['combiningClasses', 'number', 'number', combining],
    ['decompositions', 'number', 'readonly number[]', decomposition],
    ['canonicalDecompositions', 'number', 'readonly number[]', canonicalDecomposition],
    ['compositions', 'string', 'number', composition],
    ['decimalDigits', 'number', 'number', digits],
    ['caseFolding', 'number', 'readonly number[]', folding],
  ] as const

  return (
    `/** @fileoverview Generated Unicode ${inputs.version} data; run generate:unicode. See NOTICE for the Unicode license. */\n\n` +
    tables
      .map(
        ([name, key, value, data]) =>
          `export const ${name}: Readonly<Record<${key}, ${value}>> = ${JSON.stringify(data)}\n`,
      )
      .join('\n')
  )
}

/** Verify retained source hashes and exact generated tables without modifying the source during a build. */
export async function checkUnicodeTables(): Promise<void> {
  const expected = await generateUnicodeTables()
  const actual = await readFile(join(project, 'src/text/unicode.generated.ts'), 'utf8')
  if (actual.replaceAll('\r\n', '\n') !== expected) {
    throw new Error('Unicode tables are stale; run generate:unicode')
  }
}

/** Replace only the declared generated source after all retained input hashes pass. */
export async function writeUnicodeTables(signal?: AbortSignal): Promise<void> {
  const source = await generateUnicodeTables()
  signal?.throwIfAborted()

  await mkdir(join(project, 'src/text'), { recursive: true })
  await writeFile(join(project, 'src/text/unicode.generated.ts'), source)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli(writeUnicodeTables)
}
