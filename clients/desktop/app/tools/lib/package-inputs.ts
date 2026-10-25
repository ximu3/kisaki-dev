import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

/** Select public-package inputs shared by build identity and development change watching. */
export async function publicPackageBuildInputs(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && /\.(?:ts|json)$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()

  return ['src', 'tools', 'config', ...files].map((name) => join(directory, name))
}
