import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { appRoot } from '../lib/paths'
import { sha256 } from '../lib/sha256'

const requireDependency = createRequire(join(appRoot, 'package.json'))

/** A pinned font package and the files included in desktop resources. */
export interface FontInput {
  package: string
  version: string
  files: Record<string, string>
}

/** Copy the locked font files after verifying their package versions and individual digests. */
export async function copyFonts(fontInputs: FontInput[], output: string): Promise<void> {
  for (const font of fontInputs) {
    const directory = dirname(requireDependency.resolve(`${font.package}/package.json`))
    const manifest: { version: string } = JSON.parse(
      await readFile(join(directory, 'package.json'), 'utf8'),
    )
    if (manifest.version !== font.version) throw new Error('Font input version mismatch')
    const destination = join(output, font.package.split('/').at(-1)!)
    for (const [path, digest] of Object.entries(font.files)) {
      const bytes = await readFile(join(directory, path))
      if (sha256(bytes) !== digest) throw new Error('Font input checksum mismatch')
      await mkdir(dirname(join(destination, path)), { recursive: true })
      await writeFile(join(destination, path), bytes)
    }
  }
}
