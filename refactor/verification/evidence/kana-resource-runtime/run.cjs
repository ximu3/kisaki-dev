// Execute resource lifetime mechanisms in private profiles, without loading application data.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { createFixture } = require('./fixture.cjs')
const root = path.resolve(__dirname, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-resource-runtime')
const baselineFile = path.join(__dirname, '../kana-browser-scope/source-input.json')
const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
process.env.PLAYWRIGHT_BROWSERS_PATH = baseline.browserCachePath
const playwright = require(baseline.playwrightPath)
const electronPath = path.join(root, 'apps/desktop/node_modules/electron/dist/electron.exe')
for (const item of Object.values(baseline.executables)) assert.equal(sha(item.path), item.sha256)

async function main() {
  const fixture = createFixture()
  let origin
  const server = http.createServer((request, response) => {
    const item = fixture.response(new URL(request.url, origin))
    const send = () => {
      response.writeHead(item.status, item.headers)
      response.end(item.body)
    }
    if (item.delay) setTimeout(send, item.delay)
    else send()
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  async function browser(name) {
    const options = { headless: true, timeout: 15000 }
    if (name === 'chromium') options.executablePath = baseline.executables.chromium.path
    const context = await playwright[name].launchPersistentContext(
      path.join(cache, 'profiles', name),
      options
    )
    const deadline = setTimeout(() => context.close().catch(() => {}), 150000)
    const errors = []
    const consoleErrors = []
    let externalRequests = 0
    try {
      const page = await context.newPage()
      page.on('pageerror', (error) => errors.push(String(error)))
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
        if (message.text().startsWith('runtime-case:'))
          process.stdout.write(`${name} ${message.text()}\n`)
      })
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== origin) externalRequests++
      })
      await page.goto(`${origin}/host.html`, { timeout: 10000 })
      const platform = await page.evaluate(() => runtimeProbe.portEvents())
      let streams
      let deployment
      let storage
      let restart = null
      try {
        streams = await page.evaluate(() => runStreamCases())
        deployment = await page.evaluate(() => runDeploymentCases())
        storage = await page.evaluate(() => runStorageCases())
        if (name === 'chromium') {
          await page.evaluate(() => beginWorkerInterruption())
          const cdp = await context.newCDPSession(page)
          try {
            await cdp.send('ServiceWorker.enable')
            await cdp.send('ServiceWorker.stopAllWorkers')
            restart = await page.evaluate(() => finishWorkerInterruption())
          } finally {
            await cdp.detach()
          }
        }
      } catch (error) {
        const snapshot = await page.evaluate(() => ({
          budget: runtimeProbe.budget.stats,
          sources: runtimeProbe.allSources.map((source) => source.stats)
        }))
        throw new Error(JSON.stringify({ error: String(error), snapshot, errors, consoleErrors }))
      }
      const cleanup = await page.evaluate(() => runtimeProbe.finish())
      assert.equal(cleanup.mounts, 0)
      assert.equal(cleanup.leases, 0)
      assert.equal(cleanup.inflight, 0)
      assert.equal(cleanup.budget.active, 0)
      assert.equal(cleanup.budget.queued, 0)
      // WebKit surfaces intentionally errored response streams as page-error events.
      assert(
        errors.length <= 5,
        'More errors were observed than the intentional resource failures.'
      )
      assert.equal(externalRequests, 0)
      const privateContext = await context.browser().newContext()
      let privateMode
      try {
        const privatePage = await privateContext.newPage()
        await privatePage.goto(`${origin}/host.html`, { timeout: 10000 })
        privateMode = await privatePage.evaluate(async () => {
          try {
            const entry = await runtimeProbe.mount('private', { size: 1024 })
            const frame = await runtimeProbe.frameAt(`${entry.base}book/index.html`)
            const response = await frame.contentWindow.fetch(`${entry.base}book/data.bin`)
            const bytes = await response.arrayBuffer()
            const cleanup = await runtimeProbe.finish()
            return { outcome: 'available', bytes: bytes.byteLength, cleanup }
          } catch (error) {
            if (error.reason !== 'assetUnavailable') throw error
            return { outcome: 'assetUnavailable', mounts: runtimeProbe.mounts.size }
          }
        })
      } finally {
        await privateContext.close()
      }
      return {
        name,
        version: context.browser().version(),
        platform,
        streams,
        deployment,
        storage,
        restart,
        privateMode,
        cleanup,
        errors,
        externalRequests
      }
    } finally {
      clearTimeout(deadline)
      await context.close()
    }
  }
  async function electron() {
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    const child = spawn(electronPath, [path.join(__dirname, 'electron.cjs')], {
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let diagnostic = ''
    child.stdout.on('data', (data) => {
      diagnostic = (diagnostic + data).slice(-4000)
    })
    child.stderr.on('data', (data) => {
      diagnostic = (diagnostic + data).slice(-4000)
    })
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', resolve)
    })
    assert.equal(code, 0, diagnostic)
    return {
      name: 'electron',
      executableSha256: sha(electronPath),
      ...JSON.parse(fs.readFileSync(path.join(cache, 'electron-result.json'), 'utf8'))
    }
  }
  try {
    const selected = process.env.KANA_RUNTIME_ENGINE
      ? [process.env.KANA_RUNTIME_ENGINE]
      : ['chromium', 'firefox', 'webkit', 'electron']
    const settled = await Promise.allSettled(
      selected.map((name) => (name === 'electron' ? electron() : browser(name)))
    )
    const record = {
      checkedAt: new Date().toISOString(),
      sources: Object.fromEntries(
        [
          'run.cjs',
          'fixture.cjs',
          'electron.cjs',
          'bridge.js',
          'worker.js',
          'owner.js',
          'cases.js',
          'storage.js'
        ].map((file) => [file, sha(path.join(__dirname, file))])
      ),
      baselineSha256: sha(baselineFile),
      engines: settled.map((item, index) =>
        item.status === 'fulfilled'
          ? item.value
          : { name: selected[index], failed: true, error: String(item.reason) }
      ),
      httpRequests: fixture.requests,
      productionReaderExecuted: false,
      actualSafariExecuted: false,
      actualWebKitGtkExecuted: false,
      workspaceDependenciesChanged: false
    }
    fs.writeFileSync(
      path.join(__dirname, 'runtime-contract.json'),
      JSON.stringify(record, null, 2) + '\n'
    )
    process.stdout.write(
      JSON.stringify(
        record.engines.map((item) => ({
          name: item.name,
          failed: !!item.failed,
          error: item.error?.slice(0, 600)
        }))
      ) + '\n'
    )
    assert(!record.engines.some((item) => item.failed))
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
