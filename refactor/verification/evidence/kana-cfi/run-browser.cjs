// Share a finite loopback harness between two independent source/display probes.
const { readFile, writeFile } = require('node:fs/promises')
const { createHash } = require('node:crypto')
const { createServer } = require('node:http')
const path = require('node:path')

const evidence = path.dirname(__dirname)
const root = path.resolve(evidence, '../../..')
const cache = path.join(root, 'node_modules/.cache')
const baseline = require('../kana-browser-scope/source-input.json')
const playwright = require(baseline.playwrightPath)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const routes = new Map()
const add = (route, file, type) => routes.set(route, { file, type })
for (const name of [
  'grammar.mjs',
  'source.mjs',
  'book.mjs',
  'cases.mjs',
  'projection.mjs',
  'browser.mjs'
])
  add('/cfi/' + name, path.join(__dirname, name), 'text/javascript')
for (const name of ['xml.mjs', 'xml.wasm'])
  add(
    '/cfi/' + name,
    path.join(cache, 'kana-cfi', name),
    name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript'
  )
add('/cfi/catalog.json', path.join(cache, 'kana-xml-input/catalog.json'), 'application/json')
add('/cfi/catalog.dtd', path.join(cache, 'kana-xml-input/catalog.dtd'), 'text/plain')
add('/fixed/browser.mjs', path.join(evidence, 'kana-kf8-fixed/browser.mjs'), 'text/javascript')
add(
  '/fixed/node-contract.json',
  path.join(evidence, 'kana-kf8-fixed/node-contract.json'),
  'application/json'
)
add('/deps/parse5.mjs', path.join(cache, 'kana-formats/parse5.mjs'), 'text/javascript')
add('/deps/maps.json', path.join(cache, 'kana-xml-input/encoding-maps.json'), 'application/json')
add('/mapping/markup.mjs', path.join(evidence, 'kana-source-mapping/markup.mjs'), 'text/javascript')
const fixedReport = require('../kana-kf8-fixed/node-contract.json')
for (const run of fixedReport.runs.filter((item) => !item.viewport.failure)) {
  for (const document of run.documents)
    add(
      '/decoded/' + document.filename,
      path.join(cache, 'kana-kf8-fixed/decoded', document.filename),
      'application/octet-stream'
    )
  add(
    '/assets/' + run.name + '.jpg',
    path.join(cache, 'kana-kf8-fixed/decoded', run.name + '.jpg'),
    'image/jpeg'
  )
  add(
    '/assets/' + run.name + '.css',
    path.join(cache, 'kana-kf8-fixed/decoded', run.name + '.css'),
    'text/css'
  )
}
const unexpectedRoutes = []
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname
  if (pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end('<!doctype html><meta charset="utf-8"><title>Source binding proofs</title>')
    return
  }
  if (pathname === '/favicon.ico') {
    response.writeHead(204)
    response.end()
    return
  }
  const route = routes.get(pathname)
  if (!route) {
    unexpectedRoutes.push(pathname)
    response.writeHead(404)
    response.end()
    return
  }
  try {
    response.writeHead(200, { 'Content-Type': route.type, 'Cache-Control': 'no-store' })
    response.end(await readFile(route.file))
  } catch {
    response.writeHead(500)
    response.end()
  }
})
async function run() {
  const engines = process.argv[2] ? [process.argv[2]] : ['chromium', 'firefox', 'webkit']
  if (engines.some((name) => !['chromium', 'firefox', 'webkit'].includes(name)))
    throw new Error('Unknown fixture browser.')
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = 'http://127.0.0.1:' + server.address().port
  const cfiRuns = [],
    fixedRuns = []
  try {
    for (const name of engines) {
      const executable = baseline.executables[name]
      if (hash(await readFile(executable.path)) !== executable.sha256)
        throw new Error('The browser baseline changed.')
      const browser = await playwright[name].launch({
        headless: true,
        executablePath: executable.path
      })
      try {
        const context = await browser.newContext()
        const page = await context.newPage()
        const pageErrors = [],
          externalRequests = []
        page.on('pageerror', (error) => pageErrors.push(error.message))
        await context.route('**/*', async (route) => {
          if (new URL(route.request().url()).origin !== origin) {
            externalRequests.push(route.request().url())
            await route.abort()
          } else await route.continue()
        })
        await page.goto(origin)
        const cfi = await page.evaluate(async () => {
          const [{ default: factory }, { runCfiBrowser }, catalog, dtd] = await Promise.all([
            import('/cfi/xml.mjs'),
            import('/cfi/browser.mjs'),
            fetch('/cfi/catalog.json').then((response) => response.json()),
            fetch('/cfi/catalog.dtd').then((response) => response.text())
          ])
          catalog.dtd = dtd
          return runCfiBrowser(factory, catalog)
        })
        const fixed = await page.evaluate(async () =>
          (await import('/fixed/browser.mjs')).runFixedBrowser()
        )
        if (pageErrors.length || externalRequests.length || unexpectedRoutes.length)
          throw new Error(
            'Unexpected browser activity occurred: ' +
              JSON.stringify({ pageErrors, externalRequests, unexpectedRoutes })
          )
        const runtime = {
          name,
          version: browser.version(),
          executableSha256: executable.sha256,
          pageErrors,
          externalRequests
        }
        cfiRuns.push({ ...runtime, ...cfi })
        fixedRuns.push({ ...runtime, ...fixed })
        await context.close()
        process.stdout.write(
          JSON.stringify({
            name,
            cfiEndpoints: cfi.checkedEndpoints,
            cfiRanges: cfi.checkedRanges,
            fixedPages: fixed.cases.length,
            imageRestores: fixed.imageRestores
          }) + '\n'
        )
      } finally {
        await browser.close()
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
  if (engines.length !== 3) return
  const common = {
    checkedAt: new Date().toISOString(),
    platform: process.platform,
    playwrightVersion: baseline.playwrightVersion,
    harnessSha256: hash(await readFile(__filename)),
    browserBaselineSha256: hash(
      await readFile(path.join(evidence, 'kana-browser-scope/source-input.json'))
    ),
    allOwnedBrowsersClosed: true,
    serverClosed: !server.listening,
    unexpectedRoutes
  }
  const hashes = Object.fromEntries(
    await Promise.all(
      [...routes].map(async ([route, value]) => [route, hash(await readFile(value.file))])
    )
  )
  for (const [folder, runs, select] of [
    [__dirname, cfiRuns, (route) => route.startsWith('/cfi/')],
    [path.join(evidence, 'kana-kf8-fixed'), fixedRuns, (route) => !route.startsWith('/cfi/')]
  ])
    await writeFile(
      path.join(folder, 'browser-contract.json'),
      JSON.stringify(
        {
          ...common,
          inputs: Object.fromEntries(Object.entries(hashes).filter(([route]) => select(route))),
          runs
        },
        null,
        2
      ) + '\n'
    )
  await writeFile(
    path.join(evidence, 'kana-kf8-fixed/root-replacement-observation.json'),
    JSON.stringify(
      {
        ...common,
        scriptSha256: hashes['/fixed/browser.mjs'],
        source: 'Owned fixed-plain.azw3 document 0, split width 1',
        method: 'Replace the initialized HTML documentElement with a constructed HTML root',
        comparison:
          'Retain the initialized root; copy source attributes and construct children with source bindings',
        runs: fixedRuns.map((run) => ({
          name: run.name,
          version: run.version,
          executableSha256: run.executableSha256,
          replacement: run.rootReplacement,
          retainedRootPassedAllFixedCases: run.cases.length
        })),
        generalWebKitOrSafariClaim: false
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
