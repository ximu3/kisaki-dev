/** @fileoverview Starts the renderer's native Vite server against workspace package exports. */

import { createServer, defaultClientConditions } from 'vite-plus'
import type { Plugin, ViteDevServer } from 'vite-plus'
import { join } from 'node:path'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'
import { entryRecoveryEvent } from './protocol'

/** Lets a document whose module entry failed retry after a renderer source edit. */
function recoverFailedEntries(): Plugin {
  let revision = 0
  let waitingForEdit = false

  return {
    name: 'kisaki-renderer-entry-recovery',
    apply: 'serve',

    /** Answers reports even when the failed document joined the hot channel after an edit. */
    configureServer(server) {
      server.environments.client.hot.on(entryRecoveryEvent, (documentRevision: number, client) => {
        if (documentRevision === revision) {
          waitingForEdit = true
        } else {
          client.send(entryRecoveryEvent)
        }
      })
    },

    /** Loads the observer before the application and stamps the revision on the document itself. */
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

    /** Wakes failed entries on the next client edit while Vite handles ordinary updates. */
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

/** Starts Vite with workspace source exports and releases the server if listening fails. */
export async function startRenderer(sourceRoot: string, buildId: string): Promise<ViteDevServer> {
  const server = await createServer({
    configFile: join(sourceRoot, 'config', 'vite', 'vite.config.renderer.ts'),
    mode: 'development',
    plugins: [recoverFailedEntries()],
    define: { __KISAKI_BUILD_ID__: JSON.stringify(buildId) },
    resolve: { conditions: ['kisaki-source', ...defaultClientConditions], dedupe: ['solid-js'] },
  })

  try {
    await server.listen()
    if (!server.resolvedUrls?.local[0]) {
      throw new Error('Renderer server did not publish a listening address')
    }
    return server
  } catch (cause) {
    return rethrowAfterCleanup(cause, () => server.close(), 'Renderer startup and cleanup failed')
  }
}
