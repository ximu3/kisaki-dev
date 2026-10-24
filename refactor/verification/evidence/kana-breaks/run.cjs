// Record actual geometry; syntax acceptance alone is not treated as a successful break.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const here = __dirname
const root = path.resolve(here, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-breaks')
const baselinePath = path.join(here, '../kana-browser-scope/source-input.json')
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
process.env.PLAYWRIGHT_BROWSERS_PATH = baseline.browserCachePath
const playwright = require(baseline.playwrightPath)
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
for (const item of Object.values(baseline.executables)) assert.equal(sha(item.path), item.sha256)
const server = http.createServer((request, response) => {
  if (request.url === '/probe.mjs') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' })
    response.end(fs.readFileSync(path.join(here, 'probe.mjs')))
    return
  }
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; frame-src 'self'"
  })
  response.end(
    '<!doctype html><meta charset="utf-8"><title>Break probe</title><div id="stage"></div><script type="module" src="/probe.mjs"></script>'
  )
})

async function check(name, origin) {
  const options = { headless: true, viewport: { width: 900, height: 600 }, timeout: 15000 }
  if (name === 'chromium') options.executablePath = baseline.executables.chromium.path
  const context = await playwright[name].launchPersistentContext(
    path.join(cache, 'profiles', name),
    options
  )
  const deadline = setTimeout(() => context.close().catch(() => {}), 30000)
  let externalRequests = 0
  try {
    await context.route('**/*', async (route) => {
      if (
        route
          .request()
          .url()
          .startsWith(origin + '/')
      )
        await route.continue()
      else {
        externalRequests++
        await route.abort()
      }
    })
    const page = context.pages()[0] ?? (await context.newPage())
    await page.goto(origin)
    await page.waitForFunction(() => !!window.breakProof)
    const results = await page.evaluate(() => breakProof.run())
    assert.equal(results.native.length, 27)
    assert.equal(results.spacers.length, 6)
    for (const item of results.native) {
      assert.equal(item.result.sourceText, 'AB')
      if (item.declaration === 'break-before:column')
        assert.equal(item.result.fragmentIndex, name === 'firefox' ? 0 : 1)
    }
    for (const item of results.spacers) {
      assert.equal(item.manualAssignment, 'manual')
      assert.equal(item.assignedSourceNodes, 2)
      assert.equal(item.after.fragmentIndex, 1)
      assert.deepEqual(item.after.childIds, item.before.childIds)
      assert.equal(item.after.sourceText, item.before.sourceText)
      assert.equal(item.after.color, item.before.color)
      assert.equal(item.after.fontWeight, item.before.fontWeight)
      assert(item.after.sourceSiblingSelector)
      assert(Math.abs(item.after.textInset - item.before.textInset) < 0.1)
    }
    assert.equal(externalRequests, 0)
    return {
      name,
      version: context.browser().version(),
      ...results,
      externalRequests,
      actualSafariExecuted: false,
      actualWebKitGtkExecuted: false,
      clipboardWritten: false,
      sourceFormatMappingImplemented: false
    }
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
    const failed = settled.filter((item) => item.status === 'rejected')
    if (failed.length) {
      for (const item of failed) process.stderr.write(String(item.reason.stack) + '\n')
      throw new Error('A break observation did not match its recorded preconditions.')
    }
    const record = {
      checkedAt: new Date().toISOString(),
      platform: process.platform,
      playwrightVersion: baseline.playwrightVersion,
      sources: Object.fromEntries(
        ['probe.mjs', 'run.cjs'].map((name) => [name, sha(path.join(here, name))])
      ),
      baselineSha256: sha(baselinePath),
      engines: settled.map((item) => item.value)
    }
    fs.writeFileSync(
      path.join(here, 'browser-contract.json'),
      JSON.stringify(record, null, 2) + '\n'
    )
    process.stdout.write(
      JSON.stringify(
        record.engines.map(({ name, spacers, hosts }) => ({
          name,
          spacerOffsets: spacers.map(({ mode, margin, nativeReference, after }) => ({
            mode,
            margin,
            native: nativeReference.targetBlockOffset,
            spacer: after.targetBlockOffset
          })),
          unsupportedShadowHosts: hosts.filter((item) => !item.supported).map((item) => item.tag)
        }))
      ) + '\n'
    )
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

main().catch((error) => {
  process.stderr.write(String(error.stack) + '\n')
  process.exitCode = 1
})
