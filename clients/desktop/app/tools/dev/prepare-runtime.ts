import { copyFile, cp, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

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
