// Check hierarchical transport in isolated browser profiles and one hidden Electron process.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const http = require('node:http')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { prepare } = require('./fixture.cjs')
const root = path.resolve(__dirname, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-resource-transport')
const baselinePath = path.join(__dirname, '../kana-browser-scope/source-input.json')
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
process.env.PLAYWRIGHT_BROWSERS_PATH = baseline.browserCachePath
const playwright = require(baseline.playwrightPath)
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const electronPath = path.join(root, 'apps/desktop/node_modules/electron/dist/electron.exe')
for (const executable of Object.values(baseline.executables)) {
  assert.equal(sha(executable.path), executable.sha256)
}

async function main() {
  const fixture = await prepare()
  let origin
  const server = http.createServer((request, response) => {
    const item = fixture.responseFor(new URL(request.url, origin))
    response.writeHead(item.status, { 'Content-Type': item.type, 'Cache-Control': 'no-store' })
    response.end(item.body)
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
    const deadline = setTimeout(() => context.close().catch(() => {}), 90000)
    const errors = []
    const consoleErrors = []
    let externalRequests = 0
    try {
      const page = await context.newPage()
      page.on('pageerror', (error) => errors.push(String(error)))
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
        if (message.text().startsWith('transport-')) {
          process.stdout.write(`${name} ${message.text()}\n`)
        }
      })
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== origin) externalRequests++
      })
      await page.goto(`${origin}/host.html`, { timeout: 10000 })
      let result
      try {
        result = await page.evaluate((data) => probe.runCases(data), fixture.data)
      } catch (error) {
        const details = await page.evaluate(() => ({
          reads: probe.reads,
          bases: [...probe.mounts.values()].map((mount) => mount.base),
          frames: [...document.querySelectorAll('iframe')].map((frame) => frame.src)
        }))
        throw new Error(JSON.stringify({ message: String(error), details, consoleErrors }))
      }
      let restart = null
      if (name === 'chromium') {
        const cdp = await context.newCDPSession(page)
        await cdp.send('ServiceWorker.enable')
        await cdp.send('ServiceWorker.stopAllWorkers')
        restart = await page.evaluate(
          (survivor) => probe.readAfterRestart(survivor),
          result.survivor
        )
        assert.notEqual(restart.identity.bootId, result.setup.bootId)
        assert.equal(restart.readable, true)
        await cdp.detach()
      }
      const cleanup = await page.evaluate(() => probe.finishTransport())
      assert.deepEqual(cleanup, { unregistered: true, mounts: 0, pending: 0, caches: [] })
      assert.deepEqual(errors, [])
      assert.equal(externalRequests, 0)
      process.stdout.write(
        JSON.stringify({ engine: name, cases: result.cases.length, passed: true }) + '\n'
      )
      return {
        name,
        version: context.browser().version(),
        result,
        restart,
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
    fs.mkdirSync(cache, { recursive: true })
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
    const result = JSON.parse(fs.readFileSync(path.join(cache, 'electron-result.json'), 'utf8'))
    process.stdout.write(
      JSON.stringify({ engine: 'electron', passed: !result.failed, error: result.error }) + '\n'
    )
    return { name: 'electron', executableSha256: sha(electronPath), ...result }
  }
  try {
    const selected = process.env.KANA_TRANSPORT_ENGINE
      ? [process.env.KANA_TRANSPORT_ENGINE]
      : ['chromium', 'firefox', 'webkit', 'electron']
    const engines = await Promise.allSettled(
      selected.map((name) => (name === 'electron' ? electron() : browser(name)))
    )
    const record = {
      checkedAt: new Date().toISOString(),
      sources: Object.fromEntries(
        ['run.cjs', 'worker.js', 'host.js', 'fixture.cjs', 'electron.cjs'].map((file) => [
          file,
          sha(path.join(__dirname, file))
        ])
      ),
      fixtureSha256: sha(path.join(__dirname, '../kana-css-input/fixtures.mjs')),
      baselineSha256: sha(baselinePath),
      engines: engines.map((entry, index) =>
        entry.status === 'fulfilled'
          ? entry.value
          : {
              name: selected[index],
              failed: true,
              error: String(entry.reason)
            }
      ),
      httpRequests: fixture.requests,
      productionReaderExecuted: false,
      actualSafariExecuted: false,
      actualWebKitGtkExecuted: false,
      streamBackpressureExecuted: false,
      workspaceDependenciesChanged: false
    }
    assert(!fixture.requests.some((pathname) => /^\/kana-content\/.+\/book\//.test(pathname)))
    assert(!fixture.requests.includes('/outside.svg'))
    fs.writeFileSync(
      path.join(__dirname, 'transport-contract.json'),
      JSON.stringify(record, null, 2) + '\n'
    )
    process.stdout.write(
      JSON.stringify(
        record.engines.map((engine) => ({
          name: engine.name,
          failed: !!engine.failed,
          error: engine.error
        }))
      ) + '\n'
    )
    assert(!record.engines.some((engine) => engine.failed))
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
