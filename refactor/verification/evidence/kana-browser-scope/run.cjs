// Run the same local fixtures in three isolated engine contexts, including real trusted pointer input.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const here = __dirname
const root = path.resolve(here, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-browser-scope')
const input = JSON.parse(fs.readFileSync(path.join(here, 'source-input.json'), 'utf8'))
process.env.PLAYWRIGHT_BROWSERS_PATH = input.browserCachePath
const playwright = require(input.playwrightPath)
const requests = []
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://probe.invalid')
  if (url.pathname === '/probe.mjs') {
    response.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    response.end(fs.readFileSync(path.join(here, 'probe.mjs')))
    return
  }
  if (url.pathname === '/book-script.js' || url.pathname === '/outside.png') {
    requests.push({ path: url.pathname, engine: url.searchParams.get('engine') })
    response.writeHead(200, {
      'Content-Type': url.pathname.endsWith('.js') ? 'text/javascript' : 'image/svg+xml'
    })
    response.end(
      url.pathname.endsWith('.js')
        ? 'parent.bookExecutionCount += 10000'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
    )
    return
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self' blob: 'unsafe-inline'; frame-src 'self' blob:; img-src 'self' blob: data:"
  })
  response.end(
    '<!doctype html><meta charset="utf-8"><title>Browser scope probe</title><style>body{margin:0;background:rgb(250,250,250)}</style><div id="stage"></div><script type="module" src="/probe.mjs"></script>'
  )
})
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')

async function checkEngine(name, origin) {
  const options = { headless: true, viewport: { width: 1000, height: 800 }, timeout: 15000 }
  if (name === 'chromium') options.executablePath = input.executables.chromium.path
  const context = await playwright[name].launchPersistentContext(
    path.join(cache, 'profiles', name),
    options
  )
  const deadline = setTimeout(() => {
    context.close().catch(() => {})
  }, 30000)
  let externalPageRequests = 0
  try {
    await context.route('**/*', async (route) => {
      const url = route.request().url()
      if (url.startsWith(origin + '/') || url.startsWith('blob:') || url.startsWith('data:'))
        await route.continue()
      else {
        externalPageRequests++
        await route.abort()
      }
    })
    const page = context.pages()[0] ?? (await context.newPage())
    page.setDefaultTimeout(10000)
    await page.goto(origin + '/')
    await page.waitForFunction(() => !!window.scopeProof)
    await page.evaluate((name) => window.scopeProof.configure(name), name)
    const capabilities = await page.evaluate(() => window.scopeProof.capabilities())
    const events = []
    for (const allowScripts of [false, true]) {
      const content = await page.evaluate(
        (value) => window.scopeProof.prepareEvents(value),
        allowScripts
      )
      const frame = page.frameLocator('iframe[data-probe="content"]')
      await frame.getByRole('button', { name: 'Probe action' }).click()
      await frame.getByRole('link', { name: 'Follow reference' }).click()
      const observed = await page.evaluate(() => window.scopeProof.eventResult())
      const proposedPassed =
        observed.bookExecutionCount === 0 &&
        content.providedImageWidth === 80 &&
        content.sourceText === 'Readable book text' &&
        observed.hostBackground === 'rgb(250, 250, 250)' &&
        observed.events.length === 4 &&
        observed.events.every((event) => event.trusted) &&
        !observed.nodeAvailableInContent
      if (allowScripts && !proposedPassed)
        throw new Error('The proposed document boundary did not preserve ordinary interaction.')
      events.push({ allowScripts, ...content, ...observed, proposedPassed })
    }
    const layouts = await page.evaluate(() => window.scopeProof.layoutResults())
    const projections = await page.evaluate(() => window.scopeProof.projectionResults())
    if (externalPageRequests || capabilities.nodeInPage)
      throw new Error('Unexpected browser scope environment.')
    return {
      name,
      browserVersion: context.browser().version(),
      userAgent: await page.evaluate(() => navigator.userAgent),
      externalPageRequests,
      capabilities,
      events,
      layouts,
      projections,
      clipboardWritten: false,
      actualSafariExecuted: false,
      actualWebKitGtkExecuted: false,
      fullReaderExecuted: false
    }
  } finally {
    clearTimeout(deadline)
    await context.close()
  }
}

async function run() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    const settled = await Promise.allSettled(
      ['chromium', 'firefox', 'webkit'].map((name) => checkEngine(name, origin))
    )
    const failed = settled.filter((result) => result.status === 'rejected')
    if (failed.length) {
      for (const result of failed) process.stderr.write(String(result.reason.stack) + '\n')
      throw new Error('A browser scope probe failed.')
    }
    if (requests.length)
      throw new Error('A book resource escaped the content policy in the controlled fixture.')
    const engines = settled.map((result) => result.value)
    const record = {
      checkedAt: new Date().toISOString(),
      platform: process.platform,
      node: process.version,
      playwrightVersion: input.playwrightVersion,
      engines,
      unauthorizedResourceRequests: requests,
      sources: Object.fromEntries(
        ['run.cjs', 'probe.mjs', 'prepare.py', 'source-input.json'].map((name) => [
          name,
          sha(path.join(here, name))
        ])
      )
    }
    fs.writeFileSync(
      path.join(here, 'browser-contract.json'),
      JSON.stringify(record, null, 2) + '\n'
    )
    process.stdout.write(
      JSON.stringify(
        engines.map((engine) => ({
          name: engine.name,
          version: engine.browserVersion,
          eventCounts: engine.events.map((item) => ({
            allowScripts: item.allowScripts,
            count: item.events.length,
            bookCodeExecuted: item.bookExecutionCount
          })),
          layoutObservations: engine.layouts.length,
          matchingNaturalStrips: engine.layouts.filter((item) => item.naturalFlow.pageStripMatches)
            .length,
          projectionScenarios: engine.projections.length,
          externalPageRequests: engine.externalPageRequests
        }))
      ) + '\n'
    )
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}
run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
