// Run bounded comparisons against pinned pagination components in isolated browsers.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const here = __dirname
const root = path.resolve(here, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-pagination-review')
const inputPath = path.join(here, 'source-input.json')
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const baselinePath = path.join(here, '../kana-browser-scope/source-input.json')
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const pagedRoot = path.join(cache, 'paged-layout', input.commit)
for (const source of input.sources)
  assert.equal(sha(path.join(pagedRoot, source.path)), source.sha256)
for (const executable of Object.values(baseline.executables))
  assert.equal(sha(executable.path), executable.sha256)
const vivInputPath = path.join(here, '../kana-breaks/layout-input.json')
const vivInput = JSON.parse(fs.readFileSync(vivInputPath, 'utf8'))
const vivBundlePath = path.join(
  root,
  'node_modules/.cache/kana-breaks/vivliostyle/2.45.2/package/lib/vivliostyle.js'
)
assert.equal(sha(vivBundlePath), vivInput.bundleSha256)
const vivBundle = fs.readFileSync(vivBundlePath, 'utf8')
const diagnosticOriginal = 'return s===y.vertical_rl}return e}function lc'
const diagnosticReplacement = 'return s===y.vertical_rl||s===y.vertical_lr}return e}function lc'
assert.equal(vivBundle.split(diagnosticOriginal).length, 2)
const diagnosticBundle = vivBundle.replace(diagnosticOriginal, diagnosticReplacement)
process.env.PLAYWRIGHT_BROWSERS_PATH = baseline.browserCachePath
const playwright = require(baseline.playwrightPath)

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname
  if (pathname === '/probe.mjs') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' })
    response.end(fs.readFileSync(path.join(here, 'probe.mjs')))
    return
  }
  if (pathname === '/viv.js' || pathname === '/viv-diagnostic.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' })
    response.end(
      'var module={exports:{}};\n' +
        (pathname === '/viv.js' ? vivBundle : diagnosticBundle) +
        '\nwindow.Viv=module.exports;'
    )
    return
  }
  if (pathname.startsWith('/paged-layout/')) {
    const relative = pathname.slice('/paged-layout/'.length)
    if (input.sources.some((source) => source.path === relative)) {
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' })
      response.end(fs.readFileSync(path.join(pagedRoot, relative)))
      return
    }
    response.writeHead(404)
    response.end()
    return
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' data: blob:; connect-src 'self' data: blob:; img-src 'self' data: blob:; font-src 'self' data: blob:; frame-src 'self'"
  })
  response.end(
    '<!doctype html><meta charset="utf-8"><title>Pagination architecture comparison</title><style>html,body{margin:0;padding:0}</style><script type="module" src="/probe.mjs"></script>'
  )
})

async function check(name, origin) {
  const options = { headless: true, viewport: { width: 900, height: 700 }, timeout: 15000 }
  if (name === 'chromium') options.executablePath = baseline.executables.chromium.path
  const context = await playwright[name].launchPersistentContext(
    path.join(cache, 'profiles', name),
    options
  )
  const deadline = setTimeout(() => context.close().catch(() => {}), 120000)
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
    const cases = []
    for (const backend of ['paged-layout', 'vivliostyle', 'vivliostyle-diagnostic']) {
      const modes =
        backend === 'vivliostyle-diagnostic'
          ? ['vertical-lr']
          : ['horizontal-tb', 'vertical-rl', 'vertical-lr']
      for (const mode of modes) {
        for (const kind of ['blocks', 'list', 'table', 'natural']) {
          const page = await context.newPage()
          const errors = []
          page.on('pageerror', (error) => errors.push(String(error)))
          try {
            await page.goto(origin)
            await page.waitForFunction(() => !!window.paginationReview)
            const result = await page.evaluate(
              ([backend, kind, mode]) => paginationReview(backend, kind, mode),
              [backend, kind, mode]
            )
            cases.push({ ...result, errors })
          } catch (error) {
            cases.push({ backend, kind, mode, failed: true, error: String(error), errors })
          } finally {
            await page.close()
          }
        }
      }
    }
    assert.equal(externalRequests, 0)
    return { name, version: context.browser().version(), cases, externalRequests }
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
      sources: {
        'run.cjs': sha(__filename),
        'probe.mjs': sha(path.join(here, 'probe.mjs')),
        'source-input.json': sha(inputPath),
        '../kana-browser-scope/source-input.json': sha(baselinePath),
        '../kana-breaks/layout-input.json': sha(vivInputPath)
      },
      pagedLayoutCommit: input.commit,
      vivliostyleVersion: vivInput.version,
      diagnostic: {
        original: diagnosticOriginal,
        replacement: diagnosticReplacement,
        modifiedBundleSha256: crypto.createHash('sha256').update(diagnosticBundle).digest('hex'),
        adopted: false,
        completeVerticalLrFixClaimed: false
      },
      actualSafariExecuted: false,
      actualWebKitGtkExecuted: false,
      actualAssistiveTechnologyExecuted: false,
      sourceAddressRoundtripExecuted: false,
      selectionAndFocusIntegrationExecuted: false,
      completeCssCompatibilityClaimed: false,
      kanaImplementationExecuted: false,
      engines: settled.map((item) =>
        item.status === 'fulfilled' ? item.value : { failed: true, error: String(item.reason) }
      )
    }
    fs.writeFileSync(
      path.join(here, 'browser-contract.json'),
      JSON.stringify(record, null, 2) + '\n'
    )
    process.stdout.write(
      JSON.stringify(
        record.engines.map((engine) =>
          engine.failed
            ? engine
            : {
                name: engine.name,
                cases: engine.cases.length,
                failed: engine.cases.filter((item) => item.failed).length,
                sourceOrderPreserved: engine.cases.filter(
                  (item) => item.comparison?.sourceOrderPreserved
                ).length,
                explicitBreakGroupsMatched: engine.cases.filter(
                  (item) => item.comparison?.forceGroupsMatch === true
                ).length,
                stylesMatched: engine.cases.filter((item) => item.comparison?.stylesMatch).length
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
