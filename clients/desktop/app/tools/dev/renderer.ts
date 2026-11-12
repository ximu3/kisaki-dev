/**
 * @fileoverview Serves renderer pages through Vite and owns the current complete dependency copy.
 */

import { createServer } from 'vite'
import { rm } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'
import { containsPath } from '../lib/paths'
import type { DependencySnapshot } from './dependencies'
import type { DesktopDependency } from './dependencies'
import type { ViteDevServer } from 'vite'

/** Client-environment resolver used to inspect the active development dependency graph. */
type DependencyResolver = ViteDevServer['environments']['client']['pluginContainer']['resolveId']

/** Renderer server owning the dependency snapshots adopted by one development session. */
export interface DevelopmentRenderer {
  /** Current listening address; refresh can replace it. */
  readonly url: string
  /** Queries the active client resolver, including after Vite restarts. */
  resolveDependency: DependencyResolver

  /**
   * Takes ownership of a dependency candidate and refreshes documents to use it.
   *
   * Ownership transfers even if refresh or cleanup fails. A thrown restart failure restores the
   * previous snapshot selection; cleanup failure after a successful refresh leaves the new copy
   * active. Identical content releases the unused candidate.
   */
  adopt(snapshot: DependencySnapshot): Promise<void>

  /**
   * Closes Vite before removing the owned snapshot directory.
   *
   * Server or filesystem cleanup failures reject the operation.
   */
  close(): Promise<void>
}

/**
 * Starts the renderer development server and manages its dependency snapshots.
 *
 * The supplied snapshot directory is exclusively owned and removed on close. A listening failure
 * closes the created server; the returned handle owns the server and adopted copies.
 */
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

          if (importer && containsPath(snapshotDirectory, importer)) {
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
              containsPath(join(copyDirectory, 'node_modules', name), importer),
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
      /** Returns the latest listening address after any server restart. */
      get url() {
        return url
      },

      /** Forwards resolution through the current client environment. */
      resolveDependency: (...args) => server.environments.client.pluginContainer.resolveId(...args),

      /**
       * Implements {@link DevelopmentRenderer.adopt} with resolver replacement, refresh and copy
       * cleanup.
       */
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
          return rethrowAfterCleanup(
            cause,
            () => rm(nextSnapshot.directory, { recursive: true, force: true }),
            'Renderer refresh and candidate cleanup failed',
          )
        }

        if (previous) {
          await rm(previous.directory, { recursive: true, force: true })
        }
      },

      /**
       * Implements {@link DevelopmentRenderer.close}, shutting Vite before removing its snapshot
       * root.
       */
      async close() {
        await server.close()
        await rm(snapshotDirectory, { recursive: true, force: true })
      },
    }
  } catch (cause) {
    return rethrowAfterCleanup(cause, () => server.close(), 'Renderer startup and cleanup failed')
  }
}
