import { readFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, extname } from 'node:path'

export function serveDocument(
  runtime: string,
  resources: string,
  scope: string,
  developmentOrigin?: string,
) {
  return async (request: Request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'window') {
      return new Response(null, { status: 403 })
    }
    if (url.pathname === '/brand/icon.png') {
      return new Response(await readFile(join(resources, 'icons', 'icon.png')), {
        headers: { 'Content-Type': 'image/png' },
      })
    }
    const fonts = url.pathname.startsWith('/fonts/')
    const root = fonts ? join(resources, 'fonts') : join(runtime, 'renderer')
    const path = resolve(
      root,
      '.' + decodeURIComponent(fonts ? url.pathname.slice(6) : url.pathname),
    )
    const name = relative(root, path)
    if (
      name === '..' ||
      name.startsWith('..' + (process.platform === 'win32' ? '\\' : '/')) ||
      isAbsolute(name)
    ) {
      return new Response(null, { status: 403 })
    }
    const mime: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.woff2': 'font/woff2',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    }
    const type = mime[extname(path)]
    if (!type) {
      return new Response(null, { status: 404 })
    }
    try {
      const bytes = await readFile(path)
      const body = type.startsWith('text/html')
        ? bytes.toString('utf8').replaceAll('__RESOURCE_ORIGIN__', scope)
        : bytes
      return new Response(body, {
        headers: {
          'content-type': type,
          'X-Content-Type-Options': 'nosniff',
          ...(fonts && developmentOrigin && { 'Access-Control-Allow-Origin': developmentOrigin }),
        },
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return new Response(null, { status: 404 })
      }
      throw error
    }
  }
}
