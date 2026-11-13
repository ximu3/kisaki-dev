/** @fileoverview Starts the renderer's native Vite server against workspace package exports. */

import { createServer } from 'vite'
import type { ViteDevServer } from 'vite'
import { join } from 'node:path'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'
import type { DesktopDependency } from './dependencies'

/** Starts Vite with linked ESM packages and releases the server if listening fails. */
export async function startRenderer(
  sourceRoot: string,
  members: DesktopDependency[],
  buildId: string,
): Promise<ViteDevServer> {
  const server = await createServer({
    configFile: join(sourceRoot, 'config', 'vite', 'vite.config.renderer.ts'),
    mode: 'development',
    define: { __KISAKI_BUILD_ID__: JSON.stringify(buildId) },
    optimizeDeps: { exclude: members.map((member) => member.name) },
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
