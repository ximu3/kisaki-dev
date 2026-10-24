// Exercise unmodified Foliate EPUB loading and pagination with controlled author CSS.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const here = __dirname
const root = path.resolve(here, '../../../..')
const upstream = path.join(root, 'node_modules/.cache/kana-foliate-review')
const cache = path.join(root, 'node_modules/.cache/kana-breaks/foliate')
const baselinePath = path.join(here, '../kana-browser-scope/source-input.json')
const upstreamRecordPath = path.join(here, '../kana-foliate-review/source-input.json')
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
const upstreamRecord = JSON.parse(fs.readFileSync(upstreamRecordPath, 'utf8'))
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const sourceNames = ['epub.js', 'epubcfi.js', 'paginator.js']
const upstreamSources = {}
for (const name of sourceNames) {
  const source = upstreamRecord.sources.find((item) => item.path === name)
  assert.equal(sha(path.join(upstream, name)), source.sha256)
  upstreamSources[name] = source.sha256
}
for (const item of Object.values(baseline.executables)) assert.equal(sha(item.path), item.sha256)
process.env.PLAYWRIGHT_BROWSERS_PATH = baseline.browserCachePath
const playwright = require(baseline.playwrightPath)
const server = http.createServer((request, response) => {
  const name = request.url?.slice(1)
  if (sourceNames.includes(name)) {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' })
    response.end(fs.readFileSync(path.join(upstream, name)))
    return
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' blob:; frame-src 'self' blob:; img-src 'self' blob:; font-src 'self' blob:"
  })
  response.end(
    '<!doctype html><meta charset="utf-8"><title>Foliate break comparison</title><style>html,body{margin:0}</style>'
  )
})

async function check(name, origin) {
  const options = { headless: true, viewport: { width: 800, height: 600 }, timeout: 15000 }
  if (name === 'chromium') options.executablePath = baseline.executables.chromium.path
  const context = await playwright[name].launchPersistentContext(
    path.join(cache, 'profiles', name),
    options
  )
  const deadline = setTimeout(() => context.close().catch(() => {}), 45000)
  let externalRequests = 0
  try {
    await context.route('**/*', async (route) => {
      const url = route.request().url()
      if (url.startsWith(origin + '/') || url.startsWith('blob:')) await route.continue()
      else {
        externalRequests++
        await route.abort()
      }
    })
    const page = context.pages()[0] ?? (await context.newPage())
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.goto(origin)
    const results = await page.evaluate(async () => {
      const { EPUB } = await import('/epub.js')
      await import('/paginator.js')
      const results = []
      const cases = [
        ...['external', 'style-element', 'style-attribute'].flatMap((placement) =>
          ['break-before:page', 'page-break-before:always'].map((declaration) => ({
            placement,
            declaration
          }))
        ),
        { placement: 'external', declaration: 'break-before:left' },
        { placement: 'external', declaration: 'break-before:right' },
        { placement: 'external', declaration: 'break-before:auto' }
      ]
      for (const test of cases) {
        const baseStyle = 'body{margin:0;font:20px/1 serif}div{block-size:60px}'
        const rule = `#b{${test.declaration}}`
        const headStyle =
          test.placement === 'external'
            ? '<link rel="stylesheet" href="author.css"/>'
            : test.placement === 'style-element'
              ? `<style>${rule}</style>`
              : ''
        const attribute = test.placement === 'style-attribute' ? ` style="${test.declaration}"` : ''
        const files = {
          'META-INF/container.xml':
            '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
          'book.opf':
            '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">controlled-break</dc:identifier><dc:title>Controlled break</dc:title><dc:language>en</dc:language></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="css" href="author.css" media-type="text/css"/></manifest><spine><itemref idref="chapter"/></spine></package>',
          'author.css': rule,
          'chapter.xhtml': `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Controlled break</title><style>${baseStyle}</style>${headStyle}</head><body><div id="a">A</div><div id="b"${attribute}>B</div></body></html>`
        }
        const book = await new EPUB({
          loadText: async (file) => files[file] ?? null,
          loadBlob: async (file) => (file in files ? new Blob([files[file]]) : null),
          getSize: (file) => new TextEncoder().encode(files[file] ?? '').length
        }).init()
        const paginator = document.createElement('foliate-paginator')
        Object.assign(paginator.style, { display: 'block', width: '300px', height: '400px' })
        paginator.setAttribute('max-column-count', '1')
        paginator.setAttribute('max-inline-size', '1000px')
        paginator.setAttribute('margin', '0px')
        paginator.setAttribute('gap', '0%')
        document.body.append(paginator)
        try {
          paginator.open(book)
          await paginator.goTo({ index: 0 })
          const doc = paginator.getContents()[0].doc
          await doc.fonts.ready
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          )
          const first = doc.getElementById('a').getBoundingClientRect().toJSON()
          const second = doc.getElementById('b').getBoundingClientRect().toJSON()
          const style = doc.defaultView.getComputedStyle(doc.getElementById('b'))
          const sheets = [...doc.styleSheets].flatMap((sheet) =>
            [...sheet.cssRules].map((rule) => rule.cssText)
          )
          results.push({
            ...test,
            sourceText: doc.body.textContent,
            writingMode: style.writingMode,
            computedBreakBefore: style.breakBefore,
            styles: sheets,
            attribute: doc.getElementById('b').getAttribute('style'),
            first,
            second,
            stride: paginator.size,
            nextFragment: Math.abs(second.x - first.x) > paginator.size / 2,
            internalPagesIncludingEdgeSlots: paginator.pages
          })
        } finally {
          if (paginator.getContents().length) paginator.destroy()
          paginator.remove()
          book.destroy()
        }
      }
      return results
    })
    assert.equal(results.length, 9)
    for (const result of results) {
      assert.equal(result.sourceText, 'AB')
      assert.equal(result.writingMode, 'horizontal-tb')
    }
    // Keep upstream callback failures alongside completed layout observations.
    await page.waitForTimeout(100)
    assert.equal(externalRequests, 0)
    return {
      name,
      version: context.browser().version(),
      results,
      externalRequests,
      errors
    }
  } finally {
    clearTimeout(deadline)
    await context.close()
  }
}

async function main() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const origin = `http://127.0.0.1:${server.address().port}`
    const settled = await Promise.allSettled(
      ['chromium', 'firefox', 'webkit'].map((name) => check(name, origin))
    )
    const record = {
      checkedAt: new Date().toISOString(),
      upstreamCommit: upstreamRecord.commit,
      upstreamCodeModified: false,
      actualDesktopFoliateExecuted: false,
      actualWebKitGtkExecuted: false,
      actualSafariExecuted: false,
      archiveExtractionExecuted: false,
      kanaImplementationExecuted: false,
      sources: {
        'foliate.cjs': sha(__filename),
        '../kana-browser-scope/source-input.json': sha(baselinePath),
        '../kana-foliate-review/source-input.json': sha(upstreamRecordPath)
      },
      upstreamSources,
      engines: settled.map((item) =>
        item.status === 'fulfilled' ? item.value : { failed: true, error: String(item.reason) }
      )
    }
    fs.writeFileSync(
      path.join(here, 'foliate-contract.json'),
      JSON.stringify(record, null, 2) + '\n'
    )
    process.stdout.write(
      JSON.stringify(
        record.engines.map((engine) =>
          engine.failed
            ? engine
            : {
                name: engine.name,
                results: engine.results.map(
                  ({ placement, declaration, nextFragment, computedBreakBefore }) => ({
                    placement,
                    declaration,
                    nextFragment,
                    computedBreakBefore
                  })
                )
              }
        )
      ) + '\n'
    )
    if (settled.some((item) => item.status === 'rejected')) process.exitCode = 1
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

main().catch((error) => {
  process.stderr.write(String(error.stack) + '\n')
  process.exitCode = 1
})
