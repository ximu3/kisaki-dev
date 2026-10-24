// Run both source probes through fixed headless engines, using only owned loopback assets.
const { readFile, writeFile } = require('node:fs/promises')
const { createServer } = require('node:http')
const { createHash } = require('node:crypto')
const path = require('node:path')

const root = path.resolve(__dirname, '../../../..')
const evidence = path.dirname(__dirname)
const cache = path.join(root, 'node_modules/.cache')
const baseline = require('../kana-browser-scope/source-input.json')
const playwright = require(baseline.playwrightPath)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const routes = new Map()
for (const name of ['markup.mjs', 'cases.mjs', 'browser.mjs'])
  routes.set('/mapping/' + name, path.join(__dirname, name))
routes.set('/mapping/parse5.mjs', path.join(cache, 'kana-formats/parse5.mjs'))
routes.set('/mapping/maps.json', path.join(cache, 'kana-xml-input/encoding-maps.json'))
for (const name of ['cases.mjs', 'convert.mjs'])
  routes.set('/codecs/' + name, path.join(evidence, 'kana-xml-codecs', name))
for (const name of ['codec.mjs', 'codec.wasm', 'xml.mjs', 'xml.wasm'])
  routes.set('/codecs/' + name, path.join(cache, 'kana-xml-codecs/build', name))
routes.set('/codecs/fixtures.json', path.join(cache, 'kana-xml-codecs/fixtures.json'))

const requests = []
const server = createServer(async (request, response) => {
  const route = new URL(request.url, 'http://127.0.0.1').pathname
  requests.push(route)
  if (route === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end('<!doctype html><title>Source proof</title>')
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
  const mappingRuns = []
  const codecRuns = []
  try {
    for (const name of ['chromium', 'firefox', 'webkit']) {
      const executable = baseline.executables[name]
      if (hash(await readFile(executable.path)) !== executable.sha256)
        throw new Error('The fixed browser changed.')
      const browser = await playwright[name].launch({
        headless: true,
        executablePath: executable.path
      })
      try {
        const context = await browser.newContext()
        const page = await context.newPage()
        const pageErrors = []
        const externalRequests = []
        page.on('pageerror', (error) => pageErrors.push(error.message))
        await context.route('**/*', async (route) => {
          if (new URL(route.request().url()).origin !== origin) {
            externalRequests.push(route.request().url())
            await route.abort()
          } else await route.continue()
        })
        await page.goto(origin)
        const mapping = await page.evaluate(async () => {
          const { runMappingBrowser } = await import('/mapping/browser.mjs')
          return runMappingBrowser()
        })
        const codecs = await page.evaluate(async () => {
          const [{ default: codec }, { default: xml }, { runCodecCases }, fixtures] =
            await Promise.all([
              import('/codecs/codec.mjs'),
              import('/codecs/xml.mjs'),
              import('/codecs/cases.mjs'),
              fetch('/codecs/fixtures.json').then((response) => response.json())
            ])
          return runCodecCases(codec, xml, fixtures)
        })
        const runtime = {
          name,
          version: browser.version(),
          executableSha256: executable.sha256,
          pageErrors,
          externalRequests
        }
        if (pageErrors.length || externalRequests.length)
          throw new Error('Unexpected browser activity occurred.')
        mappingRuns.push({ ...runtime, ...mapping })
        codecRuns.push({ ...runtime, ...codecs })
        await context.close()
        process.stdout.write(
          JSON.stringify({
            name,
            mappingRanges: mapping.checkedRanges,
            codecCases: codecs.cases.length,
            cp932: codecs.cp932,
            activeDecoders: codecs.activeDecoders
          }) + '\n'
        )
      } finally {
        await browser.close()
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
  const common = {
    checkedAt: new Date().toISOString(),
    platform: process.platform,
    playwrightVersion: baseline.playwrightVersion,
    harnessSha256: hash(await readFile(__filename)),
    browserBaselineSha256: hash(
      await readFile(path.join(evidence, 'kana-browser-scope/source-input.json'))
    ),
    allOwnedBrowsersClosed: true,
    serverClosed: !server.listening
  }
  const fileHashes = Object.fromEntries(
    await Promise.all([...routes].map(async ([name, file]) => [name, hash(await readFile(file))]))
  )
  await writeFile(
    path.join(__dirname, 'browser-contract.json'),
    JSON.stringify(
      {
        ...common,
        inputs: Object.fromEntries(
          Object.entries(fileHashes).filter(([name]) => name.startsWith('/mapping/'))
        ),
        runs: mappingRuns
      },
      null,
      2
    ) + '\n'
  )
  await writeFile(
    path.join(evidence, 'kana-xml-codecs/browser-contract.json'),
    JSON.stringify(
      {
        ...common,
        inputs: Object.fromEntries(
          Object.entries(fileHashes).filter(([name]) => name.startsWith('/codecs/'))
        ),
        runs: codecRuns
      },
      null,
      2
    ) + '\n'
  )
}
run().catch((error) => {
  process.stderr.write(error.stack + '\n')
  process.exitCode = 1
})
