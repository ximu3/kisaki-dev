/**
 * @fileoverview Checks generated Node-API declarations against the reviewed binding
 * contract and supports explicit regeneration.
 */

import { readFile, writeFile } from 'node:fs/promises'

/** Compare the generated ABI declarations; explicit regeneration is a reviewable source edit. */
export async function checkDeclarations(
  generatedPath: string,
  sourcePath: string,
  update = false,
): Promise<void> {
  const generated = (await readFile(generatedPath, 'utf8')).replaceAll('\r\n', '\n')
  if (update) {
    await writeFile(sourcePath, generated)
    return
  }
  const source = (await readFile(sourcePath, 'utf8')).replaceAll('\r\n', '\n')
  if (source !== generated) {
    throw new Error('Native declarations changed; regenerate and review native/node/binding.d.ts')
  }
}
