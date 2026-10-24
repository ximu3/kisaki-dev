// Exercise owned headless documents with trusted pointer and keyboard input.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const here = __dirname
const root = path.resolve(here, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-focus')
const baselinePath = path.join(here, '../kana-browser-scope/source-input.json')
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
process.env.PLAYWRIGHT_BROWSERS_PATH = baseline.browserCachePath
const playwright = require(baseline.playwrightPath)
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
for (const executable of Object.values(baseline.executables))
  assert.equal(sha(executable.path), executable.sha256)
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
    '<!doctype html><meta charset="utf-8"><title>Focus probe</title><button id="before">Before reading</button><div id="stage" style="width:580px;height:400px;position:relative"></div><button id="after">After reading</button><script type="module" src="/probe.mjs"></script>'
  )
})

async function accessibleTree(client) {
  const main = await client.send('Accessibility.getFullAXTree')
  const frames = await client.send('Page.getFrameTree')
  const entries = []
  for (const item of frames.frameTree.childFrames ?? []) {
    const tree = await client.send('Accessibility.getFullAXTree', { frameId: item.frame.id })
    entries.push({
      name: item.frame.name,
      nodes: tree.nodes
        .filter((node) => !node.ignored && ['heading', 'link'].includes(node.role?.value))
        .map((node) => ({ id: node.nodeId, role: node.role.value, name: node.name?.value }))
    })
  }
  return {
    visibleFrames: main.nodes
      .filter((node) => !node.ignored && node.role?.value === 'Iframe')
      .map((node) => node.name?.value),
    entries
  }
}

async function check(name, origin) {
  const options = { headless: true, viewport: { width: 900, height: 600 }, timeout: 15000 }
  if (name === 'chromium') options.executablePath = baseline.executables.chromium.path
  const context = await playwright[name].launchPersistentContext(
    path.join(cache, 'profiles', name),
    options
  )
  const deadline = setTimeout(() => context.close().catch(() => {}), 45000)
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
    await page.waitForFunction(() => !!window.focusProof)
    const accessibilityClient = name === 'chromium' ? await context.newCDPSession(page) : null
    if (accessibilityClient) await accessibilityClient.send('Accessibility.enable')
    const cases = []
    for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr']) {
      await page.evaluate((value) => focusProof.setup(value), mode)
      const inert = await page.evaluate(() => focusProof.inertComparison())
      const axBefore = accessibilityClient ? await accessibleTree(accessibilityClient) : null
      const point = await page.evaluate(() => focusProof.linkOnMirror('second'))
      await page.mouse.click(point.x, point.y)
      const clicked = await page.evaluate(() => focusProof.state())
      assert.equal(clicked.outerFocus, 'canonical')
      assert.equal(clicked.canonicalFocus, 'second', JSON.stringify({ mode, clicked }))
      assert.equal(clicked.mirrorFocusEvents, 0)
      assert(clicked.focusedLinkVisible)
      assert.deepEqual(
        clicked.actions.map((action) => action.source),
        ['second']
      )
      assert(clicked.actions.every((action) => action.trusted))
      const reflow = await page.evaluate(() => focusProof.reflow())
      assert(
        reflow.sameDocument && reflow.sameFocusedElement && reflow.focusedLinkVisible,
        JSON.stringify({ mode, reflow })
      )
      const axAfter = accessibilityClient ? await accessibleTree(accessibilityClient) : null
      if (axBefore) {
        assert.deepEqual(axBefore.visibleFrames, ['Example chapter'])
        assert.deepEqual(axAfter.visibleFrames, ['Example chapter'])
        const initialNodes = axBefore.entries.find((item) => item.name === 'canonical').nodes
        const retainedNodes = axAfter.entries.find((item) => item.name === 'canonical').nodes
        assert.deepEqual(retainedNodes, initialNodes)
        assert.equal(initialNodes.filter((node) => node.role === 'heading').length, 1)
        assert.equal(initialNodes.filter((node) => node.role === 'link').length, 3)
      }
      const drags = []
      for (const reverse of [false, true]) {
        await page.evaluate((value) => focusProof.setup(value), mode)
        const points = await page.evaluate((value) => focusProof.dragPoints(value), reverse)
        await page.mouse.move(points.start.x, points.start.y)
        await page.mouse.down()
        await page.mouse.move(points.end.x, points.end.y, { steps: 12 })
        await page.mouse.up()
        const result = await page.evaluate(() => focusProof.state())
        assert(result.logicalSelection)
        assert(Math.abs(result.logicalSelection.anchor - points.expectedAnchor) <= 1)
        assert(Math.abs(result.logicalSelection.focus - points.expectedFocus) <= 1)
        assert.deepEqual(result.nativeSelection, result.logicalSelection)
        assert.equal(result.mirrorSelection, '')
        assert.equal(result.mirrorFocusEvents, 0)
        assert(result.events.length >= 3 && result.events.every((event) => event.trusted))
        assert(result.sameDocument && result.textPreserved)
        drags.push({ reverse, points, result })
      }
      await page.evaluate((value) => focusProof.setup(value), mode)
      await page.locator('#before').focus()
      const tabs = []
      for (let index = 0; index < 8; index++) {
        await page.keyboard.press('Tab')
        await page.waitForTimeout(80)
        tabs.push(await page.evaluate(() => focusProof.state()))
        if (tabs.at(-1).outerFocus === 'after') break
      }
      assert.deepEqual(
        tabs
          .filter((item) => item.outerFocus === 'canonical' && item.canonicalFocus)
          .map((item) => item.canonicalFocus),
        ['first', 'second', 'third']
      )
      assert.equal(tabs.at(-1).outerFocus, 'after')
      assert(
        tabs.every(
          (item) =>
            item.mirrorFocusEvents === 0 &&
            item.outerFocus !== 'mirror' &&
            item.focusedLinkVisible !== false
        )
      )
      const reverseTabs = []
      for (let index = 0; index < 8; index++) {
        await page.keyboard.press('Shift+Tab')
        await page.waitForTimeout(80)
        reverseTabs.push(await page.evaluate(() => focusProof.state()))
        if (reverseTabs.at(-1).outerFocus === 'before') break
      }
      assert.deepEqual(
        reverseTabs
          .filter((item) => item.outerFocus === 'canonical' && item.canonicalFocus)
          .map((item) => item.canonicalFocus),
        ['third', 'second', 'first']
      )
      assert.equal(reverseTabs.at(-1).outerFocus, 'before')
      assert(
        reverseTabs.every(
          (item) =>
            item.mirrorFocusEvents === 0 &&
            item.outerFocus !== 'mirror' &&
            item.focusedLinkVisible !== false
        )
      )
      for (let index = 0; index < 6; index++) {
        await page.keyboard.press('Tab')
        await page.waitForTimeout(80)
        const current = await page.evaluate(() => focusProof.state())
        if (current.outerFocus === 'canonical' && current.canonicalFocus === 'second') break
      }
      const beforeActivation = await page.evaluate(() => focusProof.state())
      assert.equal(beforeActivation.outerFocus, 'canonical')
      assert.equal(beforeActivation.canonicalFocus, 'second')
      await page.keyboard.press('Enter')
      await page
        .waitForFunction(() => focusProof.state().actions.length > 0, null, { timeout: 2000 })
        .catch(async (error) => {
          process.stderr.write(
            JSON.stringify({
              name,
              mode,
              activation: await page.evaluate(() => focusProof.state())
            }) + '\n'
          )
          throw error
        })
      const keyboardActivated = await page.evaluate(() => focusProof.state())
      assert.deepEqual(
        keyboardActivated.actions.map((item) => item.source),
        ['second']
      )
      assert(keyboardActivated.actions.every((item) => item.trusted))
      await page.evaluate((value) => focusProof.setup(value, false), mode)
      await page.locator('#before').focus()
      const nativeTabs = []
      for (let index = 0; index < 8; index++) {
        await page.keyboard.press('Tab')
        await page.waitForTimeout(80)
        nativeTabs.push(await page.evaluate(() => focusProof.state()))
        if (nativeTabs.at(-1).outerFocus === 'after') break
      }
      cases.push({
        mode,
        inert,
        clicked,
        reflow,
        drags,
        tabs,
        reverseTabs,
        keyboardActivated,
        nativeTabs,
        axBefore,
        axAfter
      })
    }
    assert.equal(externalRequests, 0)
    return {
      name,
      version: context.browser().version(),
      cases,
      externalRequests,
      nativeAccessibilityTreeInspected: name === 'chromium',
      screenReaderExecuted: false,
      actualSafariExecuted: false,
      actualWebKitGtkExecuted: false,
      clipboardWritten: false,
      sourceFormatMappingImplemented: false
    }
  } catch (error) {
    process.stderr.write(name + ': ' + String(error.stack) + '\n')
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
    if (failed.length) throw new Error('A focus mechanism probe failed.')
    const record = {
      checkedAt: new Date().toISOString(),
      platform: process.platform,
      playwrightVersion: baseline.playwrightVersion,
      baselineSha256: sha(baselinePath),
      sources: Object.fromEntries(
        ['probe.mjs', 'run.cjs'].map((name) => [name, sha(path.join(here, name))])
      ),
      engines: settled.map((item) => item.value)
    }
    fs.writeFileSync(
      path.join(here, 'browser-contract.json'),
      JSON.stringify(record, null, 2) + '\n'
    )
    process.stdout.write(
      JSON.stringify(
        record.engines.map(({ name, cases }) => ({
          name,
          cases: cases.length,
          tabs: cases.map((item) =>
            item.tabs.map((state) => state.outerFocus + '/' + state.canonicalFocus)
          ),
          ax: cases[0].axBefore
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
