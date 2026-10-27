import { createServer } from 'vite'
import { isAbsolute, join, relative, sep } from 'node:path'
import { appRoot, repositoryRoot } from '../lib/paths'
import { publicPackageBuildInputs } from '../lib/package-inputs'
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
  /** Observe runtime and package inputs; returns the watcher subscription cleanup. */
  watch(listener: (change: 'runtime' | 'public-package') => void): () => void
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
  const listeners = new Set<(change: 'runtime' | 'public-package') => void>()
  const packageInputs = (
    await Promise.all(members.map((member) => publicPackageBuildInputs(member.path)))
  ).flat()
  const runtimeInputs = [
    ...['main', 'preload', 'extension-host', 'shared'].map((name) => join(appRoot, 'src', name)),
    join(appRoot, 'native'),
    join(appRoot, 'assets'),
    ...['main', 'preload', 'extension-host', 'renderer'].map((name) =>
      join(appRoot, 'config', 'vite', `vite.config.${name}.ts`),
    ),
    join(appRoot, 'package.json'),
    join(repositoryRoot, 'pnpm-lock.yaml'),
  ]

  /** Forward owned source changes from each watcher created when Vite starts or restarts. */
  function changed(_event: string, path: string): void {
    let change: 'runtime' | 'public-package'
    if (packageInputs.some((input) => contains(input, path))) {
      change = 'public-package'
    } else if (runtimeInputs.some((input) => contains(input, path))) {
      change = 'runtime'
    } else {
      return
    }
    for (const listener of listeners) listener(change)
  }

  const server = await createServer({
    configFile: join(appRoot, 'config', 'vite', 'vite.config.renderer.ts'),
    mode: 'development',
    optimizeDeps: { exclude: members.map((member) => member.name) },
    plugins: [
      {
        name: 'desktop-public-dependency-snapshots',
        enforce: 'pre',
        configureServer(vite) {
          vite.watcher.add([...packageInputs, ...runtimeInputs])
          vite.watcher.on('all', changed)
        },
        async resolveId(source, importer, options) {
          // Imports inside a snapshot keep that generation's package resolution.
          if (importer && contains(snapshotDirectory, importer)) return null
          const specifier = source.replace(/[?#].*$/, '')
          const member = members.find(
            ({ name }) => specifier === name || specifier.startsWith(`${name}/`),
          )
          if (!member) return null

          const packageRoot = snapshot?.packages.get(member.name)
          if (!packageRoot) throw new Error('Public dependencies are not ready')
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
    if (!initialUrl) throw new Error('Renderer server did not publish a listening address')
    let url = initialUrl

    return {
      get url() {
        return url
      },

      resolveDependency: (...args) => server.environments.client.pluginContainer.resolveId(...args),

      async adopt(nextSnapshot) {
        if (snapshot?.id === nextSnapshot.id) return

        const initialBuild = snapshot === undefined
        snapshot = nextSnapshot
        if (initialBuild) {
          // Dependencies were unavailable at startup; discard unresolved optimizer entries.
          await server.restart()
          const address = server.resolvedUrls?.local[0]
          if (!address) throw new Error('Renderer restart did not publish a listening address')
          url = address
        } else {
          server.moduleGraph.invalidateAll()
          server.ws.send({ type: 'full-reload' })
        }
      },

      watch(listener) {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },

      close() {
        listeners.clear()
        return server.close()
      },
    }
  } catch (cause) {
    await server.close()
    throw cause
  }
}
