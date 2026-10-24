// Inspect a dedicated layout engine through its public CoreViewer API, without adopting it.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const here = __dirname
const root = path.resolve(here, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-breaks/vivliostyle/2.45.2')
const baselinePath = path.join(here, '../kana-browser-scope/source-input.json')
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
const input = JSON.parse(fs.readFileSync(path.join(here, 'layout-input.json'), 'utf8'))
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const bundlePath = path.join(cache, 'package/lib/vivliostyle.js')
assert.equal(sha(bundlePath), input.bundleSha256)
for (const item of Object.values(baseline.executables)) assert.equal(sha(item.path), item.sha256)
process.env.PLAYWRIGHT_BROWSERS_PATH = baseline.browserCachePath
const playwright = require(baseline.playwrightPath)
const server = http.createServer((request, response) => {
  if (request.url === '/library.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' })
    response.end(
      'var module={exports:{}};\n' +
        fs.readFileSync(bundlePath, 'utf8') +
        '\nwindow.Viv=module.exports;'
    )
    return
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' data: blob:; connect-src 'self' data: blob:; img-src 'self' data: blob:; font-src 'self' data: blob:"
  })
  response.end(
    '<!doctype html><meta charset="utf-8"><title>Layout engine comparison</title><style>html,body{margin:0}#viewport{width:280px;height:400px;position:relative}</style><div id="viewport"></div><script src="/library.js"></script>'
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
      if (url.startsWith(origin + '/') || url.startsWith('data:') || url.startsWith('blob:'))
        await route.continue()
      else {
        externalRequests++
        await route.abort()
      }
    })
    const results = []
    for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr']) {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(String(error)))
      await page.goto(origin)
      await page.waitForFunction(() => !!window.Viv?.CoreViewer)
      await page.evaluate((writingMode) => {
        const text = `<html xmlns="http://www.w3.org/1999/xhtml"><head><style>@page{size:280px 400px;margin:0}html{writing-mode:${writingMode}}body{margin:0;font:20px/1 serif}.block{block-size:60px}#b{break-before:page;margin-block-start:20px}</style></head><body><div class="block" id="a" data-probe="a">A</div><div class="block" id="b" data-probe="b">B</div></body></html>`
        window.inputDocument = new DOMParser().parseFromString(text, 'application/xhtml+xml')
        window.originalMarkup = inputDocument.documentElement.outerHTML
        window.viewer = new Viv.CoreViewer(
          { viewportElement: document.getElementById('viewport') },
          {
            autoResize: false,
            renderAllPages: true,
            allowScripts: false,
            pageViewMode: Viv.PageViewMode.SINGLE_PAGE,
            defaultPaperSize: { width: 280, height: 400 },
            pixelRatio: 1
          }
        )
        viewer.loadDocument(
          { url: location.origin + '/controlled.xhtml' },
          {
            documentObject: inputDocument
          }
        )
      }, mode)
      await page.waitForFunction(() => viewer.readyState === Viv.ReadyState.COMPLETE, null, {
        timeout: 15000
      })
      const initial = await page.evaluate(() => ({
        sizes: viewer.getPageSizes(),
        direction: viewer.getCurrentPageProgression(),
        sourceUnchanged: inputDocument.documentElement.outerHTML === originalMarkup,
        sourceAfter: inputDocument.documentElement.outerHTML,
        sourceBodyText: inputDocument.querySelector('body').textContent,
        sourceBodyChildren: [...inputDocument.querySelector('body').children].map(
          (node) => node.id
        ),
        pages: [...document.querySelectorAll('[data-vivliostyle-page-container]')].map((node) => ({
          text: node.textContent,
          sourceMarkers: [...node.querySelectorAll('[data-probe]')].map((item) =>
            item.getAttribute('data-probe')
          )
        }))
      }))
      await page.evaluate(() => viewer.navigateToPage(Viv.Navigation.NEXT))
      await page.waitForTimeout(100)
      const second = await page.evaluate(() => {
        const item = document.querySelector('#viewport [data-probe="b"]')
        return {
          markerFound: !!item,
          writingMode: item ? getComputedStyle(item).writingMode : null,
          bounds: item?.getBoundingClientRect().toJSON() ?? null,
          pageCount: viewer.getPageSizes().length
        }
      })
      const expected =
        mode === 'horizontal-tb'
          ? { x: 0, y: 20, width: 280, height: 60 }
          : mode === 'vertical-rl'
            ? { x: 200, y: 0, width: 60, height: 400 }
            : { x: 20, y: 0, width: 60, height: 400 }
      const geometryMatched =
        !!second.bounds &&
        Object.entries(expected).every(([key, value]) => Math.abs(second.bounds[key] - value) < 0.1)
      assert.equal(initial.sizes.length, 2)
      assert.deepEqual(
        initial.pages.map((item) => item.sourceMarkers),
        [['a'], ['b']]
      )
      assert.equal(initial.sourceBodyText, 'AB')
      assert.deepEqual(initial.sourceBodyChildren, ['a', 'b'])
      results.push({ mode, initial, second, expected, geometryMatched, errors })
      await page.close()
    }
    assert.equal(externalRequests, 0)
    return { name, version: context.browser().version(), results, externalRequests }
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
      libraryVersion: input.version,
      libraryAdopted: false,
      kanaIntegrationExecuted: false,
      sourceAddressRoundtripExecuted: false,
      screenReaderExecuted: false,
      sources: {
        'layout-engine.cjs': sha(__filename),
        'layout-input.json': sha(path.join(here, 'layout-input.json')),
        '../kana-browser-scope/source-input.json': sha(baselinePath)
      },
      results: settled.map((item) =>
        item.status === 'fulfilled' ? item.value : { failed: true, error: String(item.reason) }
      )
    }
    fs.writeFileSync(
      path.join(here, 'layout-contract.json'),
      JSON.stringify(record, null, 2) + '\n'
    )
    process.stdout.write(
      JSON.stringify(
        record.results.map((item) =>
          item.failed
            ? item
            : {
                name: item.name,
                cases: item.results.map(({ mode, geometryMatched, initial }) => ({
                  mode,
                  geometryMatched,
                  sourceAnnotated: !initial.sourceUnchanged
                })),
                externalRequests: item.externalRequests
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
