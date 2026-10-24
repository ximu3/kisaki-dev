import { createServer } from 'vite'
import { isAbsolute, join, relative, sep } from 'node:path'
import { appRoot, repositoryRoot } from '../lib/paths'
import type { DependencySnapshot, WorkspaceDependency } from './dependencies'

/** Vite and the public-package snapshot serving this development session. */
export interface DevelopmentRenderer {
  readonly url: string
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
  members: WorkspaceDependency[],
  initialSnapshot: DependencySnapshot | undefined,
): Promise<DevelopmentRenderer> {
  let snapshot = initialSnapshot
  const server = await createServer({
    configFile: join(appRoot, 'config', 'vite', 'vite.config.renderer.ts'),
    mode: 'development',
    optimizeDeps: { exclude: members.map((member) => member.name) },
    plugins: [
      {
        name: 'desktop-public-dependency-snapshots',
        enforce: 'pre',
        resolveId(source) {
          return snapshot?.aliases.get(source) ?? null
        },
      },
    ],
  })

  try {
    await server.listen()
    const initialUrl = server.resolvedUrls?.local[0]
    if (!initialUrl) throw new Error('Renderer server did not publish a listening address')
    let url = initialUrl

    const packageInputs = members.flatMap((member) => [
      join(member.path, 'src'),
      join(member.path, 'package.json'),
      join(member.path, 'tsdown.config.ts'),
      join(member.path, 'tsconfig.json'),
      join(member.path, 'tsconfig.lib.json'),
    ])
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
    server.watcher.add([...packageInputs, ...runtimeInputs])

    return {
      get url() {
        return url
      },

      async adopt(nextSnapshot) {
        if (snapshot?.id === nextSnapshot.id) return

        const initialBuild = snapshot === undefined
        snapshot = nextSnapshot
        if (initialBuild) {
          // A failed initial dependency build can leave unresolved imports in Vite's cache.
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
        const changed = (_event: string, path: string) => {
          if (packageInputs.some((input) => contains(input, path))) {
            listener('public-package')
          } else if (runtimeInputs.some((input) => contains(input, path))) {
            listener('runtime')
          }
        }
        server.watcher.on('all', changed)
        return () => server.watcher.off('all', changed)
      },

      close: () => server.close(),
    }
  } catch (cause) {
    await server.close()
    throw cause
  }
}
