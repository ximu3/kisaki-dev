import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'
import { createRenderer } from './server'

export interface RunningRenderer {
  readonly url: string
  close(): Promise<void>
}

export function createRendererServers(sourceRoot: string, buildId: string) {
  let generation = 0
  const pendingClose = new Set<() => Promise<void>>()

  async function open(cacheRoot: string): Promise<RunningRenderer> {
    const cache = join(cacheRoot, String(++generation))
    const server = await createRenderer(sourceRoot, buildId, cache)
    async function close() {
      await server.close()
      pendingClose.delete(close)
      await rm(cache, { recursive: true, force: true })
    }
    pendingClose.add(close)

    try {
      await server.listen()
      const url = server.resolvedUrls?.local[0]
      if (!url) {
        throw new Error('Renderer server did not publish a listening address')
      }
      return {
        get url() {
          return server.resolvedUrls?.local[0] ?? url
        },
        close,
      }
    } catch (cause) {
      return rethrowAfterCleanup(cause, close, 'Renderer startup and cleanup failed')
    }
  }

  function closeAll() {
    return Promise.allSettled(Array.from(pendingClose, (close) => close()))
  }

  return { open, closeAll }
}
