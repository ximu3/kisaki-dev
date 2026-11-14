/** @fileoverview Defines the finished desktop build identity and inventories its runtime file digests. */

import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { sha256 } from '../lib/sha256'
import type { DesktopTarget } from '../lib/targets'

/** Completed finite build, consumed by packaging and artifact verification. */
export interface DesktopBuild {
  schemaVersion: 1
  /** Opaque identifier shared by the programs compiled in this build. */
  buildId: string
  version: string
  target: DesktopTarget
  /** Runtime-relative paths mapped to the SHA-256 digest of each completed file. */
  files: Record<string, string>
  electronVersion: string
}

/**
 * Builds a relative-path-to-SHA-256 index of completed runtime files.
 *
 * The caller finishes output writes first. build.json is excluded because it contains this index.
 */
export async function runtimeFiles(directory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {}

  /** Adds file digests below one runtime directory using build-relative paths. */
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
