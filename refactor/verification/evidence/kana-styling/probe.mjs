// Observe inheritance and explicit overrides without implementing a Reader or format mapping.
const stage = document.querySelector('#stage')
const source = `<h1>Heading</h1>
<p id="paragraph">Body <ruby>字<rt>じ</rt></ruby><em>Emphasis</em></p>
<p id="normal">Normal line height</p>
<p id="fonts"><span id="letter">A</span><span id="private">\uE000</span></p>
<p id="accent">A color-coded statement</p>
<aside id="card"><p>Dark text on an authored white card</p></aside>
<svg id="graphic" xmlns="http://www.w3.org/2000/svg" width="100" height="45">
  <rect id="rect" width="100" height="45" fill="currentColor"/>
  <text id="svgtext" y="30" fill="white">A</text>
</svg>`
const css = `
@font-face {font-family:AuthorFixture;src:url(/AuthorFixture.ttf)}
@font-face {font-family:ReaderFixture;src:url(/ReaderFixture.ttf)}
@font-face {font-family:MissingFixture;src:url(/MissingFixture.ttf)}
html {font-size:16px;color:#222;background:white}
body {margin:0;font-family:AuthorFixture,serif;line-height:normal}
h1 {font-size:32px;line-height:1.1}
p {font-size:16px;color:#222;line-height:22px}
#normal {line-height:normal}
#fonts {font-size:20px}
#letter,#private {display:inline-block}
rt {font-size:8px;line-height:normal}
#accent {color:#b00020}
#card {color:#222;background:white;border:1px solid #222}
#card p {color:inherit}
`
const frame = document.createElement('iframe')
frame.style.cssText = 'width:650px;height:600px;border:0'
frame.sandbox = 'allow-scripts allow-same-origin'
stage.append(frame)
const fontUrls = new Map()

async function reset() {
  let resolvedCss = css
  for (const [name, url] of fontUrls) resolvedCss = resolvedCss.replace('/' + name + '.ttf', url)
  frame.srcdoc = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; font-src blob:"><style>${resolvedCss}</style>${source}`
  await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
  const doc = frame.contentDocument
  await Promise.all(
    ['AuthorFixture', 'ReaderFixture', 'MissingFixture'].map((name) =>
      doc.fonts.load(`20px ${name}`, 'A\uE000')
    )
  )
  await doc.fonts.ready
  return doc
}

function colorContrast(foreground, background) {
  function luminance(rgb) {
    const values = rgb
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map((value) => {
        const c = Number(value) / 255
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
  }
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

function inspect(doc) {
  const style = (id) => doc.defaultView.getComputedStyle(doc.querySelector(id))
  const root = style('html')
  const paragraph = style('#paragraph')
  const card = style('#card')
  const cardText = style('#card p')
  return {
    letterWidth: doc.querySelector('#letter').getBoundingClientRect().width,
    privateWidth: doc.querySelector('#private').getBoundingClientRect().width,
    family: style('#private').fontFamily,
    paragraphLineHeight: paragraph.lineHeight,
    normalLineHeight: style('#normal').lineHeight,
    headingLineHeight: style('h1').lineHeight,
    rubyLineHeight: style('rt').lineHeight,
    emphasisStyle: style('em').fontStyle,
    paragraphColor: paragraph.color,
    canvasColor: root.backgroundColor,
    paragraphContrast: colorContrast(paragraph.color, root.backgroundColor),
    accentColor: style('#accent').color,
    cardForeground: cardText.color,
    cardBackground: card.backgroundColor,
    cardContrast: colorContrast(cardText.color, card.backgroundColor),
    graphicColor: style('#rect').fill,
    graphicFontSize: style('#svgtext').fontSize,
    graphicBackdrop:
      style('#graphic').backgroundColor === 'rgba(0, 0, 0, 0)'
        ? root.backgroundColor
        : style('#graphic').backgroundColor,
    sourceText: doc.body.textContent,
    sourceStructure: [...doc.body.querySelectorAll('*')].map((node) => node.localName).join('/')
  }
}

function setReaderRoot(doc) {
  doc.documentElement.style.cssText = 'font-size:24px;color:#eeeeee;background:#111111'
}

function freezeGraphicInheritance(doc) {
  const graphic = doc.querySelector('#graphic')
  const values = doc.defaultView.getComputedStyle(graphic)
  const snapshot = Object.fromEntries(
    ['color', 'font-family', 'font-size', 'font-style', 'font-weight', 'line-height'].map(
      (name) => [name, values.getPropertyValue(name)]
    )
  )
  for (const [name, value] of Object.entries(snapshot)) graphic.style.setProperty(name, value)
  // This fixture has one opaque root backdrop; composite backgrounds need their own evaluation.
  graphic.style.backgroundColor = doc.defaultView.getComputedStyle(
    doc.documentElement
  ).backgroundColor
}

async function collect() {
  const observations = {}
  let doc = await reset()
  observations.author = inspect(doc)

  doc.querySelector('#fonts').style.fontFamily = 'ReaderFixture,AuthorFixture,serif'
  observations.readerFirst = inspect(doc)
  doc.querySelector('#private').style.fontFamily = 'AuthorFixture,serif'
  observations.privateOriginal = inspect(doc)

  doc = await reset()
  doc.querySelector('#fonts').style.fontFamily = 'MissingFixture,AuthorFixture,serif'
  observations.missingGlyphFallback = inspect(doc)

  doc = await reset()
  setReaderRoot(doc)
  observations.rootOnly = inspect(doc)

  doc = await reset()
  freezeGraphicInheritance(doc)
  setReaderRoot(doc)
  for (const element of doc.body.querySelectorAll('*')) {
    if (element.closest('svg')) continue
    element.style.color = '#eeeeee'
  }
  observations.foregroundOnly = inspect(doc)
  doc.querySelector('#card').style.backgroundColor = '#111111'
  observations.readingPair = inspect(doc)

  doc = await reset()
  freezeGraphicInheritance(doc)
  setReaderRoot(doc)
  doc.querySelector('#paragraph').style.color = '#eeeeee'
  doc.querySelector('#paragraph').style.fontSize = '24px'
  doc.querySelector('#paragraph').style.lineHeight = '1.8'
  doc.querySelector('#normal').style.lineHeight = '1.8'
  observations.scopedTypography = inspect(doc)

  const spacing = []
  for (const writingMode of ['horizontal-tb', 'vertical-rl', 'vertical-lr']) {
    const block = doc.createElement('div')
    block.style.cssText = `position:absolute;inset:0;width:300px;height:300px;display:flow-root;writing-mode:${writingMode};font-size:24px`
    block.innerHTML = '<p>A</p><p>B</p>'
    for (const paragraph of block.children) {
      paragraph.style.cssText =
        'font-size:24px;line-height:1;margin-block-start:0;margin-block-end:18px;margin-inline:0'
    }
    doc.body.append(block)
    const first = block.children[0].getBoundingClientRect()
    const second = block.children[1].getBoundingClientRect()
    const gap =
      writingMode === 'horizontal-tb'
        ? second.top - first.bottom
        : writingMode === 'vertical-rl'
          ? first.left - second.right
          : second.left - first.right
    spacing.push({ writingMode, gap, sourceText: block.textContent })
    block.remove()
  }
  return { observations, spacing, sourceMappingImplemented: false, fullPublicationTested: false }
}

async function run() {
  try {
    for (const name of ['AuthorFixture', 'ReaderFixture', 'MissingFixture']) {
      const response = await fetch('/' + name + '.ttf')
      if (!response.ok) throw new Error('The controlled font fixture was unavailable.')
      fontUrls.set(name, URL.createObjectURL(await response.blob()))
    }
    return await collect()
  } finally {
    frame.remove()
    for (const url of fontUrls.values()) URL.revokeObjectURL(url)
    fontUrls.clear()
  }
}

window.stylingProof = { run }
