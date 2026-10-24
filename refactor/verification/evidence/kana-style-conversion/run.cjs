// Run one coupled style scene in the existing Chromium baseline.
const { readFile, writeFile } = require('node:fs/promises')
const { createServer } = require('node:http')
const { createHash } = require('node:crypto')
const path = require('node:path')

const root = path.resolve(__dirname, '../../../..')
const cache = path.join(root, 'node_modules/.cache')
const baseline = require('../kana-browser-scope/source-input.json')
const playwright = require(baseline.playwrightPath)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const routes = new Map([
  ['/probe.mjs', [path.join(__dirname, 'probe.mjs'), 'text/javascript']],
  [
    '/css-tree.mjs',
    [
      path.join(cache, 'kana-css-input/css-tree/3.2.1/package/dist/csstree.esm.js'),
      'text/javascript'
    ]
  ],
  ...['AuthorFixture', 'ReaderFixture'].map((name) => [
    '/' + name + '.ttf',
    [path.join(cache, 'kana-styling', name + '.ttf'), 'font/ttf']
  ])
])
const externalRequests = [],
  pageErrors = []
const server = createServer(async (request, response) => {
  if (request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end('<!doctype html><meta charset="utf-8"><title>Style conversion proof</title>')
    return
  }
  const route = routes.get(request.url)
  if (!route) {
    response.writeHead(404)
    response.end()
    return
  }
  response.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-store' })
  response.end(await readFile(route[0]))
})
async function main() {
  const executable = baseline.executables.chromium
  if (hash(await readFile(executable.path)) !== executable.sha256)
    throw new Error('The browser baseline changed.')
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  let browser
  let result
  let version
  try {
    browser = await playwright.chromium.launch({ headless: true, executablePath: executable.path })
    version = browser.version()
    const context = await browser.newContext()
    await context.route('**/*', async (route) => {
      if (new URL(route.request().url()).origin !== origin) {
        externalRequests.push(route.request().url())
        await route.abort()
      } else await route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(origin)
    result = await page.evaluate(async () => (await import('/probe.mjs')).run())
    if (externalRequests.length || pageErrors.length)
      throw new Error('Unexpected browser activity.')
    await context.close()
  } finally {
    if (browser) await browser.close()
    await new Promise((resolve) => server.close(resolve))
  }
  const report = {
    checkedAt: new Date().toISOString(),
    name: 'chromium',
    version,
    executableSha256: executable.sha256,
    playwrightVersion: baseline.playwrightVersion,
    harnessSha256: hash(await readFile(__filename)),
    inputs: Object.fromEntries(
      await Promise.all(
        [...routes].map(async ([route, [file]]) => [route, hash(await readFile(file))])
      )
    ),
    externalRequests,
    pageErrors,
    browserClosed: true,
    serverClosed: !server.listening,
    ...result
  }
  await writeFile(
    path.join(__dirname, 'browser-contract.json'),
    JSON.stringify(report, null, 2) + '\n'
  )
  process.stdout.write(
    JSON.stringify({
      browser: version,
      nativeFocusComparison: result.divergentFocus,
      sharedFocus: result.sharedFocus,
      sourceTextIdentityKept: result.sourceTextIdentityKept
    }) + '\n'
  )
}
main().catch((error) => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
