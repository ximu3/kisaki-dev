import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { resolve as resolveExports } from 'resolve.exports'
import { withOutputs } from '../../../../../tools/outputs'
import type { WorkspaceProject } from '../../../../../tools/outputs'

/** A public-package snapshot retained for the development session's lifetime. */
export interface DependencySnapshot {
  id: string
  sizeBytes: number
  aliases: ReadonlyMap<string, string>
}

/** Capture complete public packages after their dependency build succeeds. */
export async function captureDependencies(
  members: WorkspaceProject[],
  directory: string,
  existing: Map<string, DependencySnapshot>,
): Promise<DependencySnapshot> {
  return withOutputs(
    members.map((member) => ({ project: member.path, mode: 'use', read: ['dist'] })),
    async () => {
      const content = new Map<string, Uint8Array>()
      const manifests = new Map<string, Parameters<typeof resolveExports>[0]>()
      let sizeBytes = 0
      const digest = createHash('sha256')

      /** Collect regular build files; linked entries are unsupported snapshot inputs. */
      async function collect(source: string, prefix: string): Promise<void> {
        for (const entry of (await readdir(source, { withFileTypes: true })).sort((a, b) =>
          a.name.localeCompare(b.name, 'en'),
        )) {
          const name = `${prefix}/${entry.name}`
          if (entry.isDirectory()) {
            await collect(join(source, entry.name), name)
          } else if (entry.isFile()) {
            const value = await readFile(join(source, entry.name))
            content.set(name, value)
            sizeBytes += value.byteLength
          } else {
            throw new Error('Public build output must not contain filesystem links')
          }
        }
      }

      for (const member of [...members].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        if (!/^@kisaki3\/[a-z0-9-]+$/.test(member.name)) {
          throw new Error('Unexpected desktop workspace dependency')
        }
        const manifest = await readFile(join(member.path, 'package.json'))
        manifests.set(member.name, JSON.parse(manifest.toString()))
        content.set(`${member.name}/package.json`, manifest)
        sizeBytes += manifest.byteLength
        await collect(join(member.path, 'dist'), `${member.name}/dist`)
      }

      for (const [name, value] of content) digest.update(name).update('\0').update(value)
      const id = digest.digest('hex')
      const previous = existing.get(id)
      if (previous) return previous

      // Snapshots remain readable until session end; cap accumulated build outputs at 256 MiB.
      const budgetBytes = 256 * 1024 * 1024
      if (
        sizeBytes + [...existing.values()].reduce((sum, item) => sum + item.sizeBytes, 0) >
        budgetBytes
      ) {
        throw new Error('Development dependency snapshots exceed 256 MiB; restart the session')
      }

      const root = join(directory, id, 'node_modules')
      const aliases = new Map<string, string>()
      for (const [name, manifest] of manifests) {
        if (
          !manifest ||
          typeof manifest !== 'object' ||
          !('name' in manifest) ||
          manifest.name !== name ||
          !('exports' in manifest) ||
          !manifest.exports ||
          typeof manifest.exports !== 'object'
        ) {
          throw new Error('Public package exports are unavailable')
        }

        for (const entry of Object.keys(manifest.exports)) {
          if (!entry.startsWith('.') || entry.includes('*')) {
            throw new Error('Desktop package exports must be explicit')
          }

          const selected = resolveExports(manifest, entry, {
            browser: true,
            conditions: ['import'],
          })?.[0]
          if (!selected) continue

          const packageRoot = join(root, name)
          const path = resolve(packageRoot, selected)
          if (!path.startsWith(`${join(packageRoot, 'dist')}${sep}`)) {
            throw new Error('Public runtime exports must use built output')
          }
          if (!content.has(relative(root, path).split(sep).join('/'))) {
            throw new Error(`Public export has no build output: ${name}${entry.slice(1)}`)
          }

          aliases.set(entry === '.' ? name : `${name}/${entry.slice(2)}`, path)
        }
      }

      try {
        for (const [name, value] of content) {
          await mkdir(dirname(join(root, name)), { recursive: true })
          await writeFile(join(root, name), value)
        }
      } catch (cause) {
        await rm(join(directory, id), { recursive: true, force: true })
        throw cause
      }

      const snapshot = { id, sizeBytes, aliases }
      existing.set(id, snapshot)
      return snapshot
    },
  )
}
