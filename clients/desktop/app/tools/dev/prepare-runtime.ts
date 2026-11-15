/** @fileoverview Copies completed compiler output and prepared resources into one owned runtime. */

import { copyFile, cp, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/**
 * Copies the compiler's completed file inventory and the target's resources for a new process.
 *
 * The session checks that the compiler batch remains current before launch and owns this directory
 * until all process readers have exited.
 */
export async function prepareRuntime(
  compilerDirectory: string,
  files: readonly string[],
  resources: string,
  nativeBinding: string,
  directory: string,
): Promise<void> {
  for (const file of files) {
    const destination = join(directory, file)
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(join(compilerDirectory, file), destination)
  }

  await cp(resources, join(directory, 'resources'), {
    recursive: true,
  })
  await copyFile(nativeBinding, join(directory, 'resources/native/kisaki-native.node'))
  await writeFile(join(directory, 'package.json'), '{"type":"module"}\n')
}
