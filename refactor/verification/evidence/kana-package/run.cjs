// Run one ZIP asset-assembly scene in the previously pinned Chromium build.
const { readFile, writeFile } = require('node:fs/promises')
const { createServer } = require('node:http')
const { createHash } = require('node:crypto')
const path = require('node:path')
const baseline = require('../kana-browser-scope/source-input.json')
const source = require('./source-input.json')
const playwright = require(baseline.playwrightPath)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const routes = new Map(
  Object.keys(source.files).map((name) => ['/' + name, path.join(source.consumer, name)])
)
routes.set('/probe.mjs', path.join(__dirname, 'probe.mjs'))
for (const label of ['a', 'b']) {
  routes.set(`/${label}/archive-worker.mjs`, path.join(source.consumer, 'archive-worker.mjs'))
  routes.set(
    `/${label}/zip-module.wasm`,
    path.join(source.consumer, 'vendor/zip/dist/zip-module.wasm')
  )
}
const requests = []
const errors = []
const server = createServer(async (request, response) => {
  if (request.url === '/') {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'"
    })
    response.end('<!doctype html><title>ZIP assembly proof</title>')
    return
  }
  const file = routes.get(request.url)
  if (!file) {
    errors.push('Unexpected route: ' + request.url)
    response.writeHead(404).end()
    return
  }
  requests.push(request.url)
  response.writeHead(200, {
    'Content-Type': file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript'
  })
  response.end(await readFile(file))
})

async function main() {
  for (const [name, digest] of Object.entries(source.files)) {
    if (hash(await readFile(path.join(source.consumer, name))) !== digest)
      throw new Error('Staged asset changed.')
  }
  const executable = baseline.executables.chromium
  if (hash(await readFile(executable.path)) !== executable.sha256)
    throw new Error('Browser baseline changed.')
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
      if (new URL(route.request().url()).origin === origin) await route.continue()
      else {
        errors.push('External request blocked.')
        await route.abort()
      }
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(origin)
    result = await page.evaluate(async () => (await import('/probe.mjs')).run())
    if (
      errors.length ||
      !['a', 'b'].every((label) => requests.includes(`/${label}/zip-module.wasm`))
    ) {
      throw new Error('Asset isolation failed: ' + JSON.stringify(errors))
    }
    await context.close()
  } finally {
    if (browser) await browser.close()
    await new Promise((resolve) => server.close(resolve))
  }
  const report = {
    checkedAt: new Date().toISOString(),
    version,
    executableSha256: executable.sha256,
    sourceReceiptSha256: hash(await readFile(path.join(__dirname, 'source-input.json'))),
    harnessSha256: hash(await readFile(__filename)),
    probeSha256: hash(await readFile(path.join(__dirname, 'probe.mjs'))),
    requests,
    errors,
    browserClosed: true,
    serverClosed: !server.listening,
    ...result
  }
  await writeFile(
    path.join(__dirname, 'browser-contract.json'),
    JSON.stringify(report, null, 2) + '\n'
  )
  process.stdout.write(
    JSON.stringify({ browser: version, wasmRoots: ['a', 'b'], otherArchiveSurvivedClose: true }) +
      '\n'
  )
}
main().catch((error) => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
