/**
 * @fileoverview Serves renderer pages through Vite and owns the current complete dependency copy.
 */

import { createServer } from 'vite'
import { rm } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'
import type { DependencySnapshot } from './dependencies'
import type { DesktopDependency } from './dependencies'
import type { ViteDevServer } from 'vite'
type DependencyResolver = ViteDevServer['environments']['client']['pluginContainer']['resolveId']

/** Vite and the dependency copy currently serving this development session. */
export interface DevelopmentRenderer {
  readonly url: string
  /** Query the active client resolver for engineering checks, including after restart. */
  resolveDependency: DependencyResolver
  /** Take ownership of a complete candidate, refresh documents, then release the previous copy. */
  adopt(snapshot: DependencySnapshot): Promise<void>
  close(): Promise<void>
}

function contains(parent: string, path: string): boolean {
  const child = relative(parent, path)
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

/** Start the renderer server; adopted copies are replaced on refresh and released on close(). */
export async function startRenderer(
  sourceRoot: string,
  members: DesktopDependency[],
  snapshotDirectory: string,
): Promise<DevelopmentRenderer> {
  let snapshot: DependencySnapshot | undefined

  const server = await createServer({
    configFile: join(sourceRoot, 'config', 'vite', 'vite.config.renderer.ts'),
    mode: 'development',
    optimizeDeps: { exclude: members.map((member) => member.name) },
    plugins: [
      {
        name: 'desktop-public-dependency-snapshots',
        enforce: 'pre',
        async resolveId(source, importer, options) {
          const specifier = source.replace(/[?#].*$/, '')
          const member = members.find(
            ({ name }) => specifier === name || specifier.startsWith(`${name}/`),
          )

          if (importer && contains(snapshotDirectory, importer)) {
            // Imports within the current copy use its package context. Installed third-party
            // dependencies retain the original package's pnpm resolution context.
            if (
              member ||
              source.startsWith('.') ||
              source.startsWith('#') ||
              source.startsWith('\0') ||
              isAbsolute(source) ||
              source.includes(':')
            ) {
              return null
            }

            const copyDirectory = join(
              snapshotDirectory,
              relative(snapshotDirectory, importer).split(sep)[0]!,
            )
            const owner = members.find(({ name }) =>
              contains(join(copyDirectory, 'node_modules', name), importer),
            )
            if (owner) {
              return this.resolve(source, join(owner.path, 'package.json'), {
                ...options,
                skipSelf: true,
              })
            }
            return null
          }

          if (!member) {
            return null
          }

          const packageRoot = snapshot?.packages.get(member.name)
          if (!packageRoot) {
            throw new Error('Public dependencies are not ready')
          }

          return this.resolve(source, join(packageRoot, 'package.json'), {
            ...options,
            skipSelf: true,
          })
        },
      },
    ],
  })

  try {
    await server.listen()
    const initialUrl = server.resolvedUrls?.local[0]
    if (!initialUrl) {
      throw new Error('Renderer server did not publish a listening address')
    }

    let url = initialUrl

    return {
      get url() {
        return url
      },

      resolveDependency: (...args) => server.environments.client.pluginContainer.resolveId(...args),

      async adopt(nextSnapshot) {
        if (snapshot?.id === nextSnapshot.id) {
          await rm(nextSnapshot.directory, { recursive: true, force: true })
          return
        }

        const previous = snapshot
        snapshot = nextSnapshot

        // A restart releases Vite's old module graph and watchers as well as reloading documents.
        try {
          await server.restart()
          const address = server.resolvedUrls?.local[0]
          if (!address) {
            throw new Error('Renderer restart did not publish a listening address')
          }
          url = address
          // Vite can retain its last valid server after a configuration error.
          server.environments.client.moduleGraph.invalidateAll()
          server.environments.client.hot.send({ type: 'full-reload' })
        } catch (cause) {
          snapshot = previous
          try {
            await rm(nextSnapshot.directory, { recursive: true, force: true })
          } catch (cleanup) {
            throw new AggregateError(
              [cause, cleanup],
              'Renderer refresh and candidate cleanup failed',
              { cause: cleanup },
            )
          }
          throw cause
        }
        if (previous) {
          await rm(previous.directory, { recursive: true, force: true })
        }
      },

      async close() {
        await server.close()
        await rm(snapshotDirectory, { recursive: true, force: true })
      },
    }
  } catch (cause) {
    await server.close()
    throw cause
  }
}
