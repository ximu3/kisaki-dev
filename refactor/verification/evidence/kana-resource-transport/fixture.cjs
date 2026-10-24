// Reuse the author-CSS specimen without rewriting its content or relative references.
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

exports.prepare = async () => {
  const source = path.join(__dirname, '../kana-css-input/fixtures.mjs')
  const { files, makeChapter } = await import(pathToFileURL(source))
  const escape = (value) =>
    value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
  const attributes = (values) =>
    Object.entries(values)
      .map(([name, value]) => `${name}="${escape(value)}"`)
      .join(' ')
  const samples = []
  for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr']) {
    for (const type of ['html', 'xhtml']) {
      const chapter = makeChapter(attributes, (text) => text, mode)
      samples.push({ mode, type, chapters: { html: chapter, xhtml: chapter } })
    }
  }
  const assets = Object.fromEntries(
    [...files].map(([pathname, body]) => [
      pathname,
      { body, type: pathname.endsWith('.css') ? 'text/css' : 'image/svg+xml' }
    ])
  )
  const host =
    '<!doctype html><html><head><meta charset="utf-8"><script src="/host.js" defer></script></head><body></body></html>'
  const staticFiles = {
    '/host.html': { body: host, type: 'text/html; charset=utf-8' },
    '/host.js': {
      body: fs.readFileSync(path.join(__dirname, 'host.js'), 'utf8'),
      type: 'text/javascript'
    },
    '/kana-content/worker.js': {
      body: fs.readFileSync(path.join(__dirname, 'worker.js'), 'utf8'),
      type: 'text/javascript'
    }
  }
  const requests = []
  const responseFor = (url) => {
    requests.push(url.pathname)
    if (staticFiles[url.pathname]) return { status: 200, ...staticFiles[url.pathname] }
    const match = /^\/reference\/(\d+)(\/book\/.*)$/.exec(url.pathname)
    if (match) {
      if (match[2] === '/book/chapter.xhtml') {
        const type = url.searchParams.get('type') === 'xhtml' ? 'xhtml' : 'html'
        return {
          status: 200,
          body: samples[Number(match[1])].chapters[type],
          type: type === 'xhtml' ? 'application/xhtml+xml' : 'text/html; charset=utf-8'
        }
      }
      const resource = assets[match[2]]
      if (resource) return { status: 200, ...resource }
    }
    return { status: 404, body: '', type: 'text/plain' }
  }
  return { data: { files: assets, samples }, responseFor, requests }
}
