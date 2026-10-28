/** @fileoverview Serves declared renderer resources through the private application origin. */

import { net, protocol } from 'electron'
import { resolve, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Register the immutable application origin before Electron becomes ready. */
export function registerApplicationScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'kisaki-app',
      privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
    },
  ])
}

/** Serve the current build's declared renderer files from the application origin. */
export function serveApplicationAssets(
  runtime: string,
  files: Readonly<Record<string, string>>,
): void {
  const root = resolve(runtime, 'renderer')
  protocol.handle('kisaki-app', async (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'native' || !['GET', 'HEAD'].includes(request.method)) {
      return new Response('Not found', { status: 404 })
    }

    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return new Response('Invalid path', { status: 400 })
    }

    const path = resolve(root, `.${pathname}`)
    const name = relative(root, path).replaceAll('\\', '/')
    if (!path.startsWith(`${root}${sep}`) || !files[`renderer/${name}`]) {
      return new Response('Not found', { status: 404 })
    }

    return net.fetch(pathToFileURL(path).href, { method: request.method })
  })
}
