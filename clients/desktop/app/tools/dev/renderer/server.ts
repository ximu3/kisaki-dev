import {
  createServer,
  defaultClientConditions,
  normalizePath,
  type Plugin,
  type ViteDevServer,
} from 'vite-plus'
import { join } from 'node:path'
import { entryRecoveryEvent } from './protocol'

function recoverFailedEntries(): Plugin {
  let revision = 0
  let waitingForEdit = false

  return {
    name: 'kisaki-renderer-entry-recovery',
    apply: 'serve',

    configureServer(server) {
      server.environments.client.hot.on(entryRecoveryEvent, (documentRevision: number, client) => {
        if (documentRevision === revision) {
          waitingForEdit = true
        } else {
          client.send(entryRecoveryEvent)
        }
      })
    },

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: {
            type: 'module',
            src: `/@fs${new URL('./entry-client.ts', import.meta.url).pathname}`,
            'data-renderer-revision': String(revision),
          },
          injectTo: 'head-prepend',
        },
      ]
    },

    hotUpdate({ timestamp }) {
      if (this.environment.name !== 'client') {
        return
      }
      revision = timestamp
      if (waitingForEdit) {
        waitingForEdit = false
        this.environment.hot.send(entryRecoveryEvent)
      }
    },
  }
}

export function createRenderer(
  sourceRoot: string,
  buildId: string,
  cacheDirectory: string,
): Promise<ViteDevServer> {
  const configFile = join(sourceRoot, 'config', 'vite', 'renderer.ts')
  return createServer({
    configFile,
    // The session keeps this listening server until the old application accepts replacement.
    server: { watch: { ignored: [normalizePath(configFile)] } },
    cacheDir: cacheDirectory,
    mode: 'development',
    plugins: [recoverFailedEntries()],
    define: { __KISAKI_BUILD_ID__: JSON.stringify(buildId) },
    resolve: { conditions: ['kisaki-source', ...defaultClientConditions], dedupe: ['solid-js'] },
  })
}
