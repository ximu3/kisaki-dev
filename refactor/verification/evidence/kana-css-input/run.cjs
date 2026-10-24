// Compare author CSS before transport rewriting, after naive rewriting, and with source reflection.
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const here = __dirname
const root = path.resolve(here, '../../../..')
const cache = path.join(root, 'node_modules/.cache/kana-css-input')
const inputPath = path.join(here, 'source-input.json')
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const baselinePath = path.join(here, '../kana-browser-scope/source-input.json')
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const parserPath = path.join(cache, 'css-tree/3.2.1/package/dist/csstree.esm.js')
assert.equal(sha(parserPath), input.bundleSha256)
for (const executable of Object.values(baseline.executables))
  assert.equal(sha(executable.path), executable.sha256)
process.env.PLAYWRIGHT_BROWSERS_PATH = baseline.browserCachePath
const playwright = require(baseline.playwrightPath)
const escape = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

async function main() {
  const css = await import(pathToFileURL(parserPath))
  const { rewriteCss, reflectedName } = await import(pathToFileURL(path.join(here, 'rewrite.mjs')))
  const { files, makeChapter } = await import(pathToFileURL(path.join(here, 'fixtures.mjs')))
  let origin
  const transformations = new Map()
  const resolve = (value, base, variant) => {
    if (value.startsWith('#')) return value
    const url = new URL(value, base)
    if (url.origin !== origin || !url.pathname.startsWith('/book/'))
      throw new Error('A controlled resource reference escaped its source scope.')
    return origin + `/mapped/${variant}` + url.pathname + url.hash
  }
  const transform = (text, base, variant, context = 'stylesheet') => {
    const result = rewriteCss(css, text, {
      base,
      context,
      reflect: variant === 'projected',
      resolve: (value, base) => resolve(value, base, variant)
    })
    transformations.set(`${variant}:${base}:${context}:${text}`, result)
    return result.css
  }
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, origin)
    response.setHeader('Cache-Control', 'no-store')
    if (url.pathname === '/chapter') {
      const variant = url.searchParams.get('variant')
      const mode = url.searchParams.get('mode')
      const type = url.searchParams.get('type')
      if (
        !['source', 'naive', 'projected', 'scoped'].includes(variant) ||
        !['horizontal-tb', 'vertical-rl', 'vertical-lr'].includes(mode) ||
        !['html', 'xhtml'].includes(type)
      ) {
        response.writeHead(400).end()
        return
      }
      const base = origin + '/book/chapter.xhtml'
      const styleText = (text, context = 'stylesheet') =>
        variant === 'source' || variant === 'scoped'
          ? text
          : transform(text, base, variant, context)
      const attributes = (values) => {
        const rendered = {}
        for (const [name, original] of Object.entries(values)) {
          const local = name.split(':').at(-1)
          const namespace = name.startsWith('xlink:') ? 'http://www.w3.org/1999/xlink' : ''
          if (variant === 'projected' && ['src', 'href', 'style'].includes(local))
            rendered[reflectedName(namespace, local)] = original
          rendered[name] =
            variant === 'source' || variant === 'scoped'
              ? original
              : local === 'style'
                ? styleText(original, 'declarationList')
                : ['src', 'href'].includes(local)
                  ? resolve(original, base, variant)
                  : original
        }
        return Object.entries(rendered)
          .map(([name, value]) => `${name}="${escape(value)}"`)
          .join(' ')
      }
      const content = makeChapter(attributes, styleText, mode)
      const displayBase =
        variant === 'source'
          ? `${origin}/book/chapter.xhtml`
          : `${origin}/mapped/${variant}/book/chapter.xhtml`
      const withBase = content.replace('<head>', `<head><base href="${displayBase}"/>`)
      response.writeHead(200, {
        'Content-Type': type === 'html' ? 'text/html; charset=utf-8' : 'application/xhtml+xml',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; base-uri 'self'"
      })
      response.end(withBase)
      return
    }
    const match = /^\/mapped\/(naive|projected|scoped)(\/book\/.*)$/.exec(url.pathname)
    const canonical = match ? match[2] : url.pathname
    const content = files.get(canonical)
    if (content === undefined) {
      response.writeHead(404).end()
      return
    }
    const stylesheet = canonical.endsWith('.css')
    const body =
      stylesheet && match && match[1] !== 'scoped'
        ? transform(content, origin + canonical, match[1])
        : content
    const send = () => {
      response.writeHead(200, {
        'Content-Type': stylesheet ? 'text/css; charset=utf-8' : 'image/svg+xml'
      })
      response.end(body)
    }
    // Network completion order must not determine author cascade order.
    if (canonical.endsWith('/nested.css')) setTimeout(send, 70)
    else if (canonical.endsWith('/base.css')) setTimeout(send, 20)
    else send()
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  async function check(name) {
    const options = { headless: true, viewport: { width: 340, height: 480 }, timeout: 15000 }
    if (name === 'chromium') options.executablePath = baseline.executables.chromium.path
    const context = await playwright[name].launchPersistentContext(
      path.join(cache, 'profiles', name),
      options
    )
    const deadline = setTimeout(() => context.close().catch(() => {}), 240000)
    let externalRequests = 0
    try {
      const cases = []
      for (const type of ['html', 'xhtml']) {
        for (const mode of ['horizontal-tb', 'vertical-rl', 'vertical-lr']) {
          for (const width of [340, 640]) {
            const attempts = await Promise.allSettled(
              ['source', 'naive', 'projected', 'scoped'].map(async (variant) => {
                const page = await context.newPage()
                const resources = new Set()
                const errors = []
                page.on('pageerror', (error) => errors.push(String(error)))
                page.on('request', (request) => {
                  const requestUrl = new URL(request.url())
                  if (requestUrl.origin !== origin) externalRequests++
                  const pathname = requestUrl.pathname
                  const canonical = pathname.replace(/^\/mapped\/(?:naive|projected|scoped)/, '')
                  if (canonical.startsWith('/book/')) resources.add(canonical)
                })
                try {
                  await page.setViewportSize({ width, height: 480 })
                  await page.goto(
                    `${origin}/chapter?variant=${variant}&type=${type}&mode=${mode}`,
                    {
                      timeout: 10000
                    }
                  )
                  const values = await page.evaluate(() => {
                    const style = (id) => getComputedStyle(document.getElementById(id))
                    const target = style('target')
                    const custom = style('custom')
                    const viewport = style('viewport-box')
                    const control = style('viewport-control')
                    return {
                      color: target.color,
                      customColor: custom.color,
                      fontSize: target.fontSize,
                      lineHeight: target.lineHeight,
                      paddingInlineStart: target.paddingInlineStart,
                      letterSpacing: target.letterSpacing,
                      borderBlockEndWidth: target.borderBlockEndWidth,
                      outlineWidth: style('image').outlineWidth,
                      outlineStyle: style('image').outlineStyle,
                      outlineColor: style('image').outlineColor,
                      linkThickness: style('link').textDecorationThickness,
                      linkContent: getComputedStyle(document.getElementById('link'), '::after')
                        .content,
                      linkRenderedWidth: document.getElementById('link').getBoundingClientRect()
                        .width,
                      linkRenderedHeight: document.getElementById('link').getBoundingClientRect()
                        .height,
                      literal: getComputedStyle(document.getElementById('target'), '::before')
                        .content,
                      svgFill: style('rect').fill,
                      svgOpacity: style('use').opacity,
                      svgStrokeWidth: style('use').strokeWidth,
                      viewportInline: viewport.inlineSize,
                      viewportBlock: viewport.blockSize,
                      viewportControlInline: control.inlineSize,
                      viewportControlBlock: control.blockSize,
                      viewportWidth: innerWidth,
                      viewportHeight: innerHeight,
                      writingMode: target.writingMode,
                      customBackground: custom.backgroundImage,
                      inlineCustomBackground: style('inline-custom').backgroundImage,
                      registeredBackground: style('registered').backgroundImage,
                      sourceBodyText: document.body.textContent,
                      bodyIds: [...document.body.querySelectorAll('[id]')].map(
                        (element) => element.id
                      ),
                      bodyAttributes: [...document.body.querySelectorAll('*')].map((element) => ({
                        name: element.localName,
                        namespace: element.namespaceURI,
                        attributes: [...element.attributes].map((attribute) => ({
                          name: attribute.name,
                          namespace: attribute.namespaceURI,
                          value: attribute.value
                        }))
                      }))
                    }
                  })
                  const generatedContentCss = values.linkContent
                  delete values.linkContent
                  const bodyAttributes = values.bodyAttributes
                  delete values.bodyAttributes
                  const normalized = (value) =>
                    value.replace(/\/mapped\/(?:naive|projected|scoped)(?=\/book\/)/g, '')
                  values.customBackground = normalized(values.customBackground)
                  values.inlineCustomBackground = normalized(values.inlineCustomBackground)
                  values.registeredBackground = normalized(values.registeredBackground)
                  return {
                    variant,
                    values,
                    generatedContentCss,
                    bodyAttributes,
                    resources: [...resources].sort(),
                    errors
                  }
                } finally {
                  await page.close()
                }
              })
            )
            const rejected = attempts.find((attempt) => attempt.status === 'rejected')
            if (rejected) throw rejected.reason
            const variants = attempts.map((attempt) => attempt.value)
            const [source, naive, projected, scoped] = variants
            assert.deepEqual(projected.values, source.values)
            assert.deepEqual(projected.resources, source.resources)
            assert.deepEqual(scoped.values, source.values)
            assert.deepEqual(scoped.resources, source.resources)
            assert.deepEqual(scoped.bodyAttributes, source.bodyAttributes)
            assert.notDeepEqual(naive.values, source.values)
            assert.equal(source.values.color, 'rgb(90, 100, 110)')
            assert.equal(source.values.paddingInlineStart, '3px')
            assert.equal(source.values.fontSize, width === 340 ? '19px' : '22px')
            assert.equal(source.values.borderBlockEndWidth, '4px')
            assert.equal(source.values.outlineWidth, '3px')
            assert.equal(source.values.outlineStyle, 'solid')
            assert.equal(source.values.outlineColor, 'rgb(120, 30, 80)')
            assert.equal(source.values.svgFill, 'rgb(20, 130, 70)')
            assert.equal(source.values.svgOpacity, '0.4')
            assert.equal(
              source.values.viewportControlInline,
              `${source.values.viewportWidth / 10}px`
            )
            assert.equal(
              source.values.viewportControlBlock,
              `${source.values.viewportHeight / 10}px`
            )
            assert(source.values.customBackground.includes('/book/styles/paper.svg'))
            assert(source.values.inlineCustomBackground.includes('/book/paper.svg'))
            assert(source.values.registeredBackground.includes('/book/art/inline.svg'))
            for (const item of variants) assert.deepEqual(item.errors, [])
            cases.push({ type, mode, width, variants })
            process.stdout.write(
              JSON.stringify({ engine: name, type, mode, width, complete: true }) + '\n'
            )
          }
        }
      }
      assert.equal(externalRequests, 0)
      return { name, version: context.browser().version(), cases, externalRequests }
    } finally {
      clearTimeout(deadline)
      await context.close()
    }
  }
  try {
    const settled = await Promise.allSettled(['chromium', 'firefox', 'webkit'].map(check))
    const record = {
      checkedAt: new Date().toISOString(),
      sources: Object.fromEntries(
        ['run.cjs', 'rewrite.mjs', 'fixtures.mjs', 'source-input.json'].map((file) => [
          file,
          sha(path.join(here, file))
        ])
      ),
      baselineSha256: sha(baselinePath),
      transformations: [...transformations.values()],
      generalHtmlTransformationImplemented: false,
      cssBreakAdaptationExecuted: false,
      readerTypographyOverridesExecuted: false,
      completeCssCompatibilityClaimed: false,
      blobResourceTransportExecuted: false,
      controlledHierarchicalTransportExecuted: true,
      actualSafariExecuted: false,
      actualWebKitGtkExecuted: false,
      sourceAddressRoundtripExecuted: false,
      engines: settled.map((item) =>
        item.status === 'fulfilled' ? item.value : { failed: true, error: String(item.reason) }
      )
    }
    fs.writeFileSync(
      path.join(here, 'browser-contract.json'),
      JSON.stringify(record, null, 2) + '\n'
    )
    process.stdout.write(
      JSON.stringify(
        record.engines.map((engine) =>
          engine.failed
            ? engine
            : {
                name: engine.name,
                groups: engine.cases.length,
                documents: engine.cases.length * 4,
                externalRequests: engine.externalRequests
              }
        )
      ) + '\n'
    )
    if (settled.some((item) => item.status === 'rejected')) process.exitCode = 1
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
}

main().catch((error) => {
  process.stderr.write(String(error.stack) + '\n')
  process.exitCode = 1
})
