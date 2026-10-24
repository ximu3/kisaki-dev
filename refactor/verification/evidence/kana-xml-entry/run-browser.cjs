// Check native-only resource loading and the complete entry in disposable worker contexts.
const { readFile, writeFile } = require('node:fs/promises')
const { createServer } = require('node:http')
const { createHash } = require('node:crypto')
const path = require('node:path')
const root = path.resolve(__dirname, '../../../..')
const cache = path.join(root, 'node_modules/.cache')
const baseline = require('../kana-browser-scope/source-input.json')
const playwright = require(baseline.playwrightPath)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const routes = new Map()
for (const name of ['input.mjs', 'cases.mjs', 'worker.mjs'])
  routes.set('/entry/' + name, path.join(__dirname, name))
for (const name of ['xml.mjs', 'xml.wasm', 'codec.mjs', 'codec.wasm', 'registry.json'])
  routes.set('/entry/' + name, path.join(cache, 'kana-xml-entry/build', name))
routes.set('/entry/fixtures.json', path.join(cache, 'kana-xml-entry/fixtures.json'))
routes.set('/entry/catalog.json', path.join(cache, 'kana-xml-input/catalog.json'))
routes.set('/entry/catalog.dtd', path.join(cache, 'kana-xml-input/catalog.dtd'))
routes.set('/kana-xml-codecs/convert.mjs', path.join(__dirname, '../kana-xml-codecs/convert.mjs'))
const requests = []
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname
  requests.push(route)
  if (route === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end('<!doctype html><title>XML entry proof</title>')
    return
  }
  const file = routes.get(route)
  if (!file) {
    response.writeHead(404)
    response.end()
    return
  }
  try {
    response.writeHead(200, {
      'Content-Type': file.endsWith('.wasm')
        ? 'application/wasm'
        : file.endsWith('.json')
          ? 'application/json'
          : file.endsWith('.dtd')
            ? 'text/plain'
            : 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store'
    })
    response.end(await readFile(file))
  } catch {
    response.writeHead(500)
    response.end()
  }
})

async function run() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  const runs = []
  try {
    for (const name of ['chromium', 'firefox', 'webkit']) {
      const executable = baseline.executables[name]
      if (hash(await readFile(executable.path)) !== executable.sha256)
        throw new Error('The browser input changed.')
      const browser = await playwright[name].launch({
        headless: true,
        executablePath: executable.path
      })
      try {
        const context = await browser.newContext()
        const page = await context.newPage()
        const errors = []
        const externalRequests = []
        page.on('pageerror', (error) => errors.push(error.message))
        await context.route('**/*', async (route) => {
          if (new URL(route.request().url()).origin !== origin) {
            externalRequests.push(route.request().url())
            await route.abort()
          } else await route.continue()
        })
        await page.goto(origin)
        const phases = {}
        for (const phase of ['native', 'full']) {
          const before = requests.length
          const result = await page.evaluate(
            (phase) =>
              new Promise((resolve, reject) => {
                const worker = new Worker('/entry/worker.mjs', { type: 'module' })
                const timer = setTimeout(() => {
                  worker.terminate()
                  reject(new Error('The XML worker timed out.'))
                }, 45000)
                worker.onmessage = ({ data }) => {
                  clearTimeout(timer)
                  worker.terminate()
                  if (data.ok) resolve(data)
                  else reject(new Error(data.error))
                }
                worker.onerror = () => {
                  clearTimeout(timer)
                  worker.terminate()
                  reject(new Error('The XML worker failed.'))
                }
                worker.postMessage(phase)
              }),
            phase
          )
          const assetRequests = requests
            .slice(before)
            .filter((route) => /\/codec\.(mjs|wasm)$/.test(route))
          if (
            result.hasDomParser ||
            result.hasDocument ||
            result.activeParsers ||
            result.activeDecoders
          )
            throw new Error('The worker retained unexpected capabilities or active parsers.')
          if (phase === 'native' && (assetRequests.length || result.codecModuleLoads))
            throw new Error('Native XML loaded the optional codec.')
          if (
            phase === 'full' &&
            (result.codecModuleLoads !== 1 ||
              !assetRequests.includes('/entry/codec.mjs') ||
              !assetRequests.includes('/entry/codec.wasm'))
          )
            throw new Error('The full XML entry did not load the expected codec.')
          phases[phase] = { assetRequests, workerTerminated: true, ...result }
        }
        if (errors.length || externalRequests.length)
          throw new Error('Unexpected browser activity occurred.')
        runs.push({
          name,
          version: browser.version(),
          executableSha256: executable.sha256,
          errors,
          externalRequests,
          phases
        })
        await context.close()
        process.stdout.write(
          JSON.stringify({
            name,
            nativeCases: phases.native.cases.length,
            nativeCodecRequests: phases.native.assetRequests.length,
            fullCases: phases.full.cases.length,
            extra: phases.full.extra.length
          }) + '\n'
        )
      } finally {
        await browser.close()
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
  const record = {
    checkedAt: new Date().toISOString(),
    platform: process.platform,
    playwrightVersion: baseline.playwrightVersion,
    browserBaselineSha256: hash(
      await readFile(path.join(__dirname, '../kana-browser-scope/source-input.json'))
    ),
    harnessSha256: hash(await readFile(__filename)),
    inputs: Object.fromEntries(
      await Promise.all(
        [...routes].map(async ([route, file]) => [route, hash(await readFile(file))])
      )
    ),
    runs,
    serverClosed: !server.listening,
    allOwnedBrowsersClosed: true
  }
  await writeFile(
    path.join(__dirname, 'browser-contract.json'),
    JSON.stringify(record, null, 2) + '\n'
  )
}
run().catch((error) => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
