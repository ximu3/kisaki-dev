/**
 * @fileoverview Serves renderer development pages through Vite and adopts public-package
 * snapshots for module resolution.
 */

import { createServer } from 'vite'
import { isAbsolute, join, relative, sep } from 'node:path'
import { appRoot } from '../lib/paths'
import type { DependencySnapshot } from './dependencies'
import type { DesktopDependency } from './dependencies'
import type { DependencyResolver } from './dependencies'

/** Vite and the public-package snapshot serving this development session. */
export interface DevelopmentRenderer {
  readonly url: string
  /** Resolve candidate exports through Vite's current client environment, including after restart. */
  resolveDependency: DependencyResolver
  /** Change public imports after a successful package build and refresh loaded documents. */
  adopt(snapshot: DependencySnapshot): Promise<void>
  close(): Promise<void>
}

function contains(parent: string, path: string): boolean {
  const child = relative(parent, path)
  return child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

/** Start the renderer server and retain its current public-package resolution until close(). */
export async function startRenderer(
  members: DesktopDependency[],
  snapshotDirectory: string,
): Promise<DevelopmentRenderer> {
  let snapshot: DependencySnapshot | undefined

  const server = await createServer({
    configFile: join(appRoot, 'config', 'vite', 'vite.config.renderer.ts'),
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
            // Public and relative imports stay in their generation. Installed third-party
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

            const generation = relative(snapshotDirectory, importer).split(sep)[0]!
            const owner = members.find(({ name }) =>
              contains(join(snapshotDirectory, generation, 'node_modules', name), importer),
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
          return
        }

        const initialBuild = snapshot === undefined
        snapshot = nextSnapshot

        if (initialBuild) {
          // Dependencies were unavailable at startup; discard unresolved optimizer entries.
          await server.restart()
          const address = server.resolvedUrls?.local[0]
          if (!address) {
            throw new Error('Renderer restart did not publish a listening address')
          }

          url = address
        } else {
          server.moduleGraph.invalidateAll()
          server.ws.send({ type: 'full-reload' })
        }
      },

      close() {
        return server.close()
      },
    }
  } catch (cause) {
    await server.close()
    throw cause
  }
}
