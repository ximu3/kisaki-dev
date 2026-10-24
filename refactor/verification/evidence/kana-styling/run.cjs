// Reuse the already prepared engine builds; no browser download or user profile is involved.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const here = __dirname
const root = path.resolve(here, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-styling')
const baselinePath = path.join(here, '../kana-browser-scope/source-input.json')
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
process.env.PLAYWRIGHT_BROWSERS_PATH = baseline.browserCachePath
const playwright = require(baseline.playwrightPath)
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const fonts = JSON.parse(fs.readFileSync(path.join(cache, 'fonts.json'), 'utf8'))
for (const executable of Object.values(baseline.executables)) {
  assert.equal(executable.sha256, sha(executable.path))
}
assert.equal(fonts.generatorSha256, sha(path.join(here, 'prepare.py')))
for (const font of fonts.fonts) {
  assert.equal(font.sha256, sha(path.join(cache, font.name + '.ttf')))
}
const allowedFonts = new Set(fonts.fonts.map((font) => '/' + font.name + '.ttf'))
const server = http.createServer((request, response) => {
  if (allowedFonts.has(request.url)) {
    response.writeHead(200, { 'Content-Type': 'font/ttf', 'Cache-Control': 'no-store' })
    response.end(fs.readFileSync(path.join(cache, request.url.slice(1))))
  } else if (request.url === '/probe.mjs') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' })
    response.end(fs.readFileSync(path.join(here, 'probe.mjs')))
  } else if (request.url === '/') {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; frame-src 'self'; font-src 'self' blob:"
    })
    response.end(
      '<!doctype html><meta charset="utf-8"><title>Styling probe</title><div id="stage"></div><script type="module" src="/probe.mjs"></script>'
    )
  } else {
    response.writeHead(404)
    response.end()
  }
})

async function check(name, origin) {
  const options = { headless: true, viewport: { width: 850, height: 800 }, timeout: 15000 }
  if (name === 'chromium') options.executablePath = baseline.executables.chromium.path
  const context = await playwright[name].launchPersistentContext(
    path.join(cache, 'profiles', name),
    options
  )
  const deadline = setTimeout(() => context.close().catch(() => {}), 30000)
  let externalRequests = 0
  const diagnostics = []
  try {
    await context.route('**/*', async (route) => {
      if (
        route
          .request()
          .url()
          .startsWith(origin + '/') ||
        route.request().url().startsWith('blob:')
      )
        await route.continue()
      else {
        externalRequests++
        await route.abort()
      }
    })
    const page = context.pages()[0] ?? (await context.newPage())
    page.on('console', (message) => {
      if (message.type() === 'error') diagnostics.push(message.text())
    })
    await page.goto(origin)
    await page.waitForFunction(() => !!window.stylingProof)
    const result = await page.evaluate(() => window.stylingProof.run())
    const value = result.observations
    const close = (actual, expected) => assert(Math.abs(actual - expected) < 0.1)
    close(value.author.privateWidth, 20)
    close(value.readerFirst.privateWidth, 6)
    close(value.readerFirst.letterWidth, 9)
    close(value.privateOriginal.privateWidth, 20)
    close(value.privateOriginal.letterWidth, 9)
    close(value.missingGlyphFallback.privateWidth, 20)
    assert(value.rootOnly.paragraphContrast < 1.3)
    assert.notEqual(value.rootOnly.graphicColor, value.author.graphicColor)
    assert.notEqual(value.rootOnly.graphicFontSize, value.author.graphicFontSize)
    assert.notEqual(value.rootOnly.graphicBackdrop, value.author.graphicBackdrop)
    assert(value.foregroundOnly.cardContrast < 1.3)
    assert(value.readingPair.cardContrast > 10)
    assert.notEqual(value.readingPair.accentColor, value.author.accentColor)
    assert.equal(value.readingPair.graphicColor, value.author.graphicColor)
    assert.equal(value.readingPair.graphicFontSize, value.author.graphicFontSize)
    assert.equal(value.readingPair.graphicBackdrop, value.author.graphicBackdrop)
    close(parseFloat(value.scopedTypography.paragraphLineHeight), 43.2)
    assert.equal(value.scopedTypography.headingLineHeight, value.author.headingLineHeight)
    assert.equal(value.scopedTypography.rubyLineHeight, value.author.rubyLineHeight)
    assert.equal(value.scopedTypography.emphasisStyle, 'italic')
    for (const observation of Object.values(value)) {
      assert.equal(observation.sourceText, value.author.sourceText)
      assert.equal(observation.sourceStructure, value.author.sourceStructure)
    }
    for (const item of result.spacing) {
      close(item.gap, 18)
      assert.equal(item.sourceText, 'AB')
    }
    assert.equal(externalRequests, 0)
    return {
      name,
      version: context.browser().version(),
      ...result,
      externalRequests,
      actualSafariTested: false,
      actualWebKitGtkTested: false,
      clipboardWritten: false
    }
  } catch (error) {
    process.stderr.write(JSON.stringify({ name, diagnostics, externalRequests }) + '\n')
    throw error
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
      throw new Error('A styling mechanism observation failed.')
    }
    const record = {
      checkedAt: new Date().toISOString(),
      platform: process.platform,
      playwrightVersion: baseline.playwrightVersion,
      baselineSha256: sha(baselinePath),
      fonts,
      sources: Object.fromEntries(
        ['prepare.py', 'probe.mjs', 'run.cjs'].map((name) => [name, sha(path.join(here, name))])
      ),
      engines: settled.map((item) => item.value)
    }
    fs.writeFileSync(
      path.join(here, 'browser-contract.json'),
      JSON.stringify(record, null, 2) + '\n'
    )
    process.stdout.write(
      JSON.stringify(
        record.engines.map(({ name, version, observations, spacing }) => ({
          name,
          version,
          observationCount: Object.keys(observations).length,
          spacingCount: spacing.length,
          passed: true
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
