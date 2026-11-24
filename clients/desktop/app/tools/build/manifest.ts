import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { sha256 } from '../lib/sha256'
import type { DesktopTarget } from '../lib/targets'

export interface DesktopBuild {
  schemaVersion: 1
  buildId: string
  version: string
  target: DesktopTarget
  files: Record<string, string>
  electronVersion: string
}

export async function runtimeFiles(directory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}

  async function visit(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) {
        await visit(path)
      } else {
        const name = relative(directory, path).replaceAll('\\', '/')
        if (name !== 'build.json') {
          files[name] = sha256(await readFile(path))
        }
      }
    }
  }

  await visit(directory)

  return files
}
