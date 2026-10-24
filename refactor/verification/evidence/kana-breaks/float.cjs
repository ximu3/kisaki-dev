// Compare one float-based break adjustment across layout contexts and a real reflow.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const here = __dirname
const root = path.resolve(here, '../../../..')
const baselinePath = path.join(here, '../kana-browser-scope/source-input.json')
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
for (const executable of Object.values(baseline.executables))
  assert.equal(sha(executable.path), executable.sha256)
process.env.PLAYWRIGHT_BROWSERS_PATH = baseline.browserCachePath
const playwright = require(baseline.playwrightPath)

async function check(name) {
  const options = { headless: true, viewport: { width: 900, height: 700 }, timeout: 15000 }
  if (name === 'chromium') options.executablePath = baseline.executables.chromium.path
  const context = await playwright[name].launchPersistentContext(
    path.join(root, 'node_modules/.cache/kana-breaks/float/profiles', name),
    options
  )
  const deadline = setTimeout(() => context.close().catch(() => {}), 45000)
  let externalRequests = 0
  try {
    await context.route('**/*', async (route) => {
      externalRequests++
      await route.abort()
    })
    const page = context.pages()[0] ?? (await context.newPage())
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.setContent('<!doctype html><title>Float break contexts</title>')
    const cases = await page.evaluate(async () => {
      const results = []
      const contexts = [
        { name: 'blocks', content: '<div id="a">A</div><div id="b">B</div>' },
        { name: 'list', content: '<ol><li id="a">A</li><li id="b">B</li></ol>' },
        {
          name: 'nested',
          content: '<section><div id="a">A</div><div id="b">B</div></section>'
        },
        {
          name: 'bfc-outer',
          content:
            '<section style="display:flow-root"><div id="a">A</div><div id="b">B</div></section>'
        },
        {
          name: 'bfc-inner',
          local: true,
          content:
            '<section style="display:flow-root"><div id="a">A</div><div id="b">B</div></section>'
        },
        {
          name: 'bfc-list',
          content: '<ol style="display:flow-root"><li id="a">A</li><li id="b">B</li></ol>'
        },
        {
          name: 'whole-table',
          content: '<div id="a">A</div><table id="b"><tbody><tr><td>B</td></tr></tbody></table>'
        },
        {
          name: 'table-row',
          margin: 0,
          content:
            '<table><tbody><tr id="a"><td>A</td></tr><tr id="b"><td>B</td></tr></tbody></table>'
        },
        {
          name: 'repeat-list',
          repeat: true,
          content: '<ol><li id="a">A</li><li id="b">B</li><li id="c">C</li></ol>'
        },
        {
          name: 'repeat-blocks',
          repeat: true,
          interleaved: true,
          content: '<div id="a">A</div><div id="b">B</div><div id="c">C</div>'
        }
      ]
      for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr']) {
        for (const test of contexts) {
          const margin = test.margin ?? 20
          const frame = document.createElement('iframe')
          frame.style.cssText = 'width:280px;height:400px;border:0'
          const ready = new Promise((resolve) => (frame.onload = resolve))
          frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><style>html,body{margin:0;writing-mode:${mode}}#flow{column-count:1;column-gap:20px;column-fill:auto}ol{margin:0;padding:0;list-style-position:inside}table{border-collapse:collapse;border-spacing:0;inline-size:100%}td{padding:0}#a,#b,#c{block-size:3em;font-family:monospace;line-height:1}#b,#c{margin-block-start:${margin}px;break-before:column}#a+#b{color:red;font-weight:bold}</style><style id="dimensions">#flow{width:280px;height:400px;font-size:20px}</style><style id="control"></style><div id="flow">${test.content}</div>`
          document.body.replaceChildren(frame)
          await ready
          const doc = frame.contentDocument
          const flow = doc.getElementById('flow')
          const a = doc.getElementById('a')
          const b = doc.getElementById('b')
          const c = doc.getElementById('c')
          const originalNodes = [...flow.querySelectorAll('*')]
          const originalMarkup = flow.innerHTML
          const snapshot = () => {
            const range = doc.createRange()
            range.selectNodeContents(flow)
            const currentNodes = [...flow.querySelectorAll('*')]
            const style = doc.defaultView.getComputedStyle(b)
            return {
              first: a.getBoundingClientRect().toJSON(),
              second: b.getBoundingClientRect().toJSON(),
              third: c?.getBoundingClientRect().toJSON() ?? null,
              sourceText: flow.textContent,
              rangeText: range.toString(),
              sourceMarkupPreserved: flow.innerHTML === originalMarkup,
              sourceNodesPreserved:
                originalNodes.length === currentNodes.length &&
                originalNodes.every((node, index) => node === currentNodes[index]),
              sourceSiblingSelector: b.matches('#a + #b'),
              color: style.color,
              fontWeight: style.fontWeight,
              marginBlockStart: style.marginBlockStart
            }
          }
          const native = snapshot()
          const host = test.local ? flow.firstElementChild : flow
          const children = [...host.childNodes]
          const shadow = host.attachShadow({ mode: 'open', slotAssignment: 'manual' })
          const slot = doc.createElement('slot')
          slot.style.display = 'contents'
          shadow.append(slot)
          slot.assign(...children)
          const layouts = []
          for (const layout of [
            { width: 280, height: 400, fontSize: 20 },
            { width: 360, height: 500, fontSize: 26 }
          ]) {
            shadow.replaceChildren(slot)
            slot.assign(...children)
            frame.style.width = `${layout.width}px`
            frame.style.height = `${layout.height}px`
            doc.getElementById('dimensions').textContent =
              `#flow{width:${layout.width}px;height:${layout.height}px;font-size:${layout.fontSize}px}`
            doc.getElementById('control').textContent =
              '#b,#c{break-before:auto!important;clear:none!important}'
            const before = snapshot()
            const block = mode === 'horizontal-tb' ? layout.height : layout.width
            const inline = mode === 'horizontal-tb' ? layout.width : layout.height
            const firstExtent = mode === 'horizontal-tb' ? before.first.height : before.first.width
            const appendFloat = (size, start, beforeSlot = slot) => {
              const element = doc.createElement('div')
              element.setAttribute('aria-hidden', 'true')
              const shape =
                mode === 'horizontal-tb'
                  ? `inset(${start}px 0 0 0)`
                  : mode === 'vertical-rl'
                    ? `inset(0 ${start}px 0 0)`
                    : `inset(0 0 0 ${start}px)`
              element.style.cssText = `float:inline-start;inline-size:${inline}px;block-size:${size}px;shape-outside:${shape};margin:0;padding:0;border:0;pointer-events:none`
              shadow.insertBefore(element, beforeSlot)
            }
            doc.getElementById('control').textContent =
              '#b,#c{break-before:auto!important;clear:both!important}'
            if (test.interleaved) {
              shadow.replaceChildren()
              for (const [index, child] of children.entries()) {
                const childSlot = doc.createElement('slot')
                childSlot.style.display = 'contents'
                shadow.append(childSlot)
                childSlot.assign(child)
                if (index === children.length - 1) continue
                const bounds = [...child.getClientRects()].at(-1)
                const end =
                  mode === 'horizontal-tb'
                    ? bounds.bottom
                    : mode === 'vertical-rl'
                      ? layout.width - bounds.left
                      : bounds.right
                appendFloat(Math.max(0, block - end), 0, null)
                if (margin) appendFloat(margin, 0, null)
              }
            } else {
              appendFloat(block, firstExtent)
              if (margin) appendFloat(margin, 0)
              if (test.repeat) {
                appendFloat(block, firstExtent)
                if (margin) appendFloat(margin, 0)
              }
            }
            const after = snapshot()
            const expected = {
              first:
                mode === 'horizontal-tb'
                  ? { x: 0, y: 0, width: inline, height: firstExtent }
                  : {
                      x: mode === 'vertical-rl' ? block - firstExtent : 0,
                      y: 0,
                      width: firstExtent,
                      height: inline
                    },
              second:
                mode === 'horizontal-tb'
                  ? { x: inline + 20, y: margin, width: inline, height: firstExtent }
                  : {
                      x: mode === 'vertical-rl' ? block - firstExtent - margin : margin,
                      y: inline + 20,
                      width: firstExtent,
                      height: inline
                    }
            }
            if (test.repeat)
              expected.third =
                mode === 'horizontal-tb'
                  ? { x: (inline + 20) * 2, y: margin, width: inline, height: firstExtent }
                  : {
                      x: mode === 'vertical-rl' ? block - firstExtent - margin : margin,
                      y: (inline + 20) * 2,
                      width: firstExtent,
                      height: inline
                    }
            const geometryMatched = Object.entries(expected).every(([name, bounds]) =>
              Object.entries(bounds).every(
                ([key, value]) => Math.abs(after[name][key] - value) < 0.1
              )
            )
            layouts.push({
              ...layout,
              before,
              after,
              expected,
              geometryMatched,
              sameDocument: frame.contentDocument === doc
            })
          }
          results.push({ mode, context: test.name, native, layouts })
        }
      }
      document.body.replaceChildren()
      return results
    })
    assert.equal(cases.length, 30)
    const matchingContexts = new Set([
      'blocks',
      'list',
      'nested',
      'bfc-inner',
      'whole-table',
      'repeat-blocks'
    ])
    for (const item of cases) {
      for (const layout of item.layouts) {
        assert.equal(layout.geometryMatched, matchingContexts.has(item.context))
        assert(layout.sameDocument)
        assert(layout.after.sourceMarkupPreserved)
        assert(layout.after.sourceNodesPreserved)
        assert(layout.after.sourceSiblingSelector)
        assert.equal(layout.after.sourceText, item.context.startsWith('repeat-') ? 'ABC' : 'AB')
        assert.equal(layout.after.rangeText, layout.after.sourceText)
        assert.equal(layout.after.color, layout.before.color)
        assert.equal(layout.after.fontWeight, layout.before.fontWeight)
      }
    }
    assert.deepEqual(errors, [])
    assert.equal(externalRequests, 0)
    return { name, version: context.browser().version(), cases, externalRequests, errors }
  } finally {
    clearTimeout(deadline)
    await context.close()
  }
}

async function main() {
  const settled = await Promise.allSettled(['chromium', 'firefox', 'webkit'].map(check))
  const record = {
    checkedAt: new Date().toISOString(),
    sources: {
      'float.cjs': sha(__filename),
      '../kana-browser-scope/source-input.json': sha(baselinePath)
    },
    candidateAdopted: false,
    generalBreakpointResolutionImplemented: false,
    formatSourceMappingImplemented: false,
    clipboardWritten: false,
    actualSafariExecuted: false,
    actualWebKitGtkExecuted: false,
    actualAssistiveTechnologyExecuted: false,
    fullReaderExecuted: false,
    engines: settled.map((item) =>
      item.status === 'fulfilled' ? item.value : { failed: true, error: String(item.reason) }
    )
  }
  fs.writeFileSync(path.join(here, 'float-contract.json'), JSON.stringify(record, null, 2) + '\n')
  process.stdout.write(
    JSON.stringify(
      record.engines.map((engine) =>
        engine.failed
          ? engine
          : {
              name: engine.name,
              matchingLayouts: engine.cases
                .flatMap((item) => item.layouts)
                .filter((layout) => layout.geometryMatched).length,
              nonMatchingLayouts: engine.cases
                .flatMap((item) => item.layouts)
                .filter((layout) => !layout.geometryMatched).length,
              externalRequests: engine.externalRequests
            }
      )
    ) + '\n'
  )
  if (settled.some((item) => item.status === 'rejected')) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(String(error.stack) + '\n')
  process.exitCode = 1
})
