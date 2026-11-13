/** @fileoverview Generates the database's fixed Unicode tables from explicitly supplied, hash-verified UCD inputs. */

import { createHash } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'
import { appRoot } from '../lib/paths'
import inputs from '../../assets/unicode/inputs.json' with { type: 'json' }

/** Loads one verified source document without changing its original bytes. */
async function readSource(directory: string, name: keyof typeof inputs.files): Promise<string> {
  const bytes = await readFile(join(directory, name))
  if (createHash('sha256').update(bytes).digest('hex') !== inputs.files[name]) {
    throw new Error(`Unicode input does not match the fixed source: ${name}`)
  }
  return bytes.toString('utf8')
}

/** Extracts a whitespace-separated sequence of hexadecimal code points. */
function points(value: string): number[] {
  return value
    .trim()
    .split(/\s+/u)
    .map((part) => Number.parseInt(part, 16))
}

/** Writes deterministic normalization, folding and decimal data for the fixed Unicode version. */
async function generate(directory: string): Promise<void> {
  const sources = await Promise.all([
    readSource(directory, 'UnicodeData.txt'),
    readSource(directory, 'DerivedNormalizationProps.txt'),
    readSource(directory, 'CaseFolding.txt'),
    readSource(directory, 'NormalizationTest.txt'),
  ])
  const exclusions = new Set<number>()
  for (const line of sources[1]!.split('\n')) {
    const [range, property] = line
      .split('#')[0]!
      .split(';')
      .map((part) => part.trim())
    if (property !== 'Full_Composition_Exclusion') {
      continue
    }
    const [start, end = start] = range!.split('..').map((part) => Number.parseInt(part, 16))
    for (let point = start!; point <= end!; point += 1) {
      exclusions.add(point)
    }
  }

  const decomposition: Record<number, number[]> = {}
  const combining: Record<number, number> = {}
  const composition: [number, number, number][] = []
  const digits: Record<number, number> = {}
  for (const line of sources[0]!.split('\n')) {
    if (!line) {
      continue
    }
    const fields = line.split(';')
    const code = Number.parseInt(fields[0]!, 16)
    if (Number(fields[3]) !== 0) {
      combining[code] = Number(fields[3])
    }
    if (fields[2] === 'Nd') {
      digits[code] = Number(fields[6])
    }
    if (fields[5]) {
      const mapping = points(fields[5].replace(/^<[^>]+>\s*/u, ''))
      decomposition[code] = mapping
      if (!fields[5].startsWith('<') && mapping.length === 2 && !exclusions.has(code)) {
        composition.push([mapping[0]!, mapping[1]!, code])
      }
    }
  }

  const folding: Record<number, number[]> = {}
  for (const line of sources[2]!.split('\n')) {
    const [point, status, mapping] = line
      .split('#')[0]!
      .split(';')
      .map((part) => part.trim())
    if (status === 'C' || status === 'F') {
      folding[Number.parseInt(point!, 16)] = points(mapping!)
    }
  }

  const output = join(appRoot, 'src/main/infrastructure/database/text/unicode.generated.json')
  await mkdir(dirname(output), { recursive: true })
  await writeFile(
    output,
    `${JSON.stringify({ version: inputs.version, decomposition, combining, composition, folding, digits })}\n`,
  )

  const fixture = join(appRoot, 'tests/fixtures/unicode/NormalizationTest.txt.gz')
  await mkdir(dirname(fixture), { recursive: true })
  await writeFile(fixture, gzipSync(sources[3]!, { level: 9 }))
}

const { values } = parseArgs({ options: { input: { type: 'string' } } })
if (!values.input) {
  throw new Error('Provide --input with the directory containing the fixed Unicode source files')
}
await generate(resolve(values.input))
