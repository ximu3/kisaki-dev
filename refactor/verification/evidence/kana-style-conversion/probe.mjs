// One coupled scene checks the remaining conversion mechanisms, not a production reader.
import * as css from '/css-tree.mjs'

const check = (value, message) => {
  if (!value) throw new Error(message)
}
const layer = 'kana_proof_reader'
const stateName = 'data-kana-proof-focus'
const originalStyleName = 'data-kana-proof-style'
const authorCss = `
@namespace svg url("http://www.w3.org/2000/svg");
@layer author, accents;
@property --measure { syntax:"<length>"; inherits:true; initial-value:32px; }
@font-face { font-family:AuthorFixture;src:url(/AuthorFixture.ttf); }
@font-face { font-family:ReaderFixture;src:url(/ReaderFixture.ttf); }
html { font-size:16px; }
body { margin:0;font:16px/1.4 AuthorFixture,serif;color:#222;background:white;--measure:2em; }
@layer author {
  #ordinary::before { content:"A";font-size:10px!important; }
  #private::before { content:attr(data-symbol);font-size:20px;font-family:AuthorFixture; }
}
[style^="font-size:20px"] { border-left:3px solid rgb(1,2,3); }
#ordinary::after { content:attr(style);font-size:8px; }
#ordinary { margin:0; }
#link:focus + #state { margin-left:19px; }
#link { display:inline-block; }
svg|svg { height:40px;width:calc(var(--measure) + 2rem); }
svg|text { fill:currentColor; }
#picture { background:linear-gradient(90deg,#fff,#ffe9bd);color:#452000; }
#white { text-transform:uppercase; }
#ghost { visibility:hidden; }
#ghost span { visibility:visible; }
#contents { display:contents; }
`
const markup = `
<p id="ordinary" style="font-size:20px!important;line-height:14px">Straße</p>
<p id="private" data-symbol="&#xE000;">A</p>
<a id="link" href="#ordinary">Link</a><span id="state">State</span>
<svg id="graphic" xmlns="http://www.w3.org/2000/svg"><text id="drawing" y="25">A</text></svg>
<aside id="picture"><p id="caption">Picture caption</p></aside>
<p id="white">Straße   B</p>
<p id="ghost">Hidden <span id="revealed">Visible</span></p>
<div id="contents"><span id="contained">Boxless parent</span></div>
`
function transformCss(sharedFocus) {
  const ast = css.parse(authorCss)
  const replacements = []
  css.walk(ast, {
    enter(node) {
      if (node.type === 'AttributeSelector' && css.ident.decode(node.name.name) === 'style')
        node.name.name = originalStyleName
      if (
        node.type === 'Function' &&
        node.name === 'attr' &&
        node.children.first?.type === 'Identifier' &&
        node.children.first.name === 'style'
      )
        node.children.first.name = originalStyleName
      if (sharedFocus && node.type === 'PseudoClassSelector' && node.name === 'focus') {
        const replacement = css.parse(`[${stateName}]`, { context: 'selector' }).children.first
        replacements.push(() => {
          for (const key of Object.keys(node)) delete node[key]
          Object.assign(node, replacement)
        })
      }
    }
  })
  replacements.forEach((replace) => replace())
  return `@layer ${layer};\n` + css.generate(ast)
}
async function createView(sharedFocus) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'width:640px;height:480px;border:0'
  const loaded = new Promise((resolve) => {
    iframe.onload = resolve
  })
  iframe.srcdoc = `<!doctype html><meta charset="utf-8"><style>${transformCss(sharedFocus)}</style>${markup}`
  document.body.append(iframe)
  await loaded
  const doc = iframe.contentDocument
  const sourceStyles = new Map()
  for (const element of doc.querySelectorAll('[style]')) {
    sourceStyles.set(element, element.getAttribute('style'))
    element.setAttribute(originalStyleName, element.getAttribute('style'))
  }
  await Promise.all(
    ['AuthorFixture', 'ReaderFixture'].map((name) => doc.fonts.load(`20px ${name}`, 'A\uE000'))
  )
  await doc.fonts.ready
  const sheet = new iframe.contentWindow.CSSStyleSheet()
  doc.adoptedStyleSheets = [sheet]
  const touched = new Set()
  const style = (id, pseudo) =>
    iframe.contentWindow.getComputedStyle(doc.getElementById(id), pseudo)
  const nativeText = doc.getElementById('ordinary').firstChild
  const range = doc.createRange()
  range.setStart(nativeText, 0)
  range.setEnd(nativeText, 6)
  function restore() {
    sheet.replaceSync('')
    for (const element of touched) {
      const source = sourceStyles.get(element)
      if (source === undefined) element.removeAttribute('style')
      else element.setAttribute('style', source)
    }
    touched.clear()
  }
  function set(element, property, value) {
    touched.add(element)
    element.style.setProperty(property, value, 'important')
  }
  function apply(size) {
    restore()
    const baseline = Number.parseFloat(iframe.contentWindow.getComputedStyle(doc.body).fontSize)
    const ordinarySize = Number.parseFloat(style('ordinary').fontSize)
    const beforeSize = Number.parseFloat(style('ordinary', '::before').fontSize)
    const privateFamily = style('private', '::before').fontFamily
    const privateSize = style('private', '::before').fontSize
    const graphic = doc.getElementById('graphic')
    const inherited = Object.fromEntries(
      ['font-size', 'font-family', 'line-height', 'color', '--measure'].map((name) => [
        name,
        style('graphic').getPropertyValue(name)
      ])
    )
    for (const [property, value] of Object.entries(inherited)) set(graphic, property, value)
    set(graphic, 'background-color', 'white')
    set(doc.body, 'font-size', `${size}px`)
    set(doc.body, 'font-family', 'ReaderFixture,AuthorFixture,serif')
    set(doc.body, 'color', '#eeeeee')
    set(doc.body, 'background-color', '#111111')
    set(doc.getElementById('ordinary'), 'font-size', `${(ordinarySize * size) / baseline}px`)
    set(doc.getElementById('ordinary'), 'line-height', '1.8')
    // The scene's gradient paint context keeps its authored foreground/background relationship.
    set(doc.getElementById('picture'), 'color', '#452000')
    sheet.replaceSync(`@layer ${layer} {
      #ordinary::before {font-size:${(beforeSize * size) / baseline}px!important}
      #private::before {font-family:${privateFamily}!important;font-size:${(Number.parseFloat(privateSize) * size) / baseline}px!important}
    }`)
    return inspect()
  }
  function inspect() {
    return {
      ordinarySize: style('ordinary').fontSize,
      beforeSize: style('ordinary', '::before').fontSize,
      privateFamily: style('private', '::before').fontFamily,
      privateSize: style('private', '::before').fontSize,
      lineHeight: style('ordinary').lineHeight,
      originalAttributeMatch: style('ordinary').borderLeftWidth,
      reflectedStyle: style('ordinary', '::after').content,
      graphicWidth: graphicWidth(),
      graphicFont: style('graphic').fontSize,
      graphicColor: style('drawing').fill,
      graphicMeasure: style('graphic').getPropertyValue('--measure'),
      rootSize: iframe.contentWindow.getComputedStyle(doc.documentElement).fontSize,
      captionColor: style('caption').color,
      gradient: style('picture').backgroundImage,
      focusMargin: style('state').marginLeft,
      text: range.toString(),
      sameTextNode: nativeText === doc.getElementById('ordinary').firstChild
    }
  }
  function graphicWidth() {
    return doc.getElementById('graphic').getBoundingClientRect().width
  }
  return { iframe, doc, apply, inspect, restore, sourceStyles }
}
function whitespaceControl(doc, runs, language = 'en') {
  const control = doc.createElement('div')
  control.style.cssText = 'position:absolute;left:-100000px;top:0;width:1000px;text-transform:none;'
  control.lang = language
  for (const { text, whiteSpace } of runs) {
    const span = doc.createElement('span')
    span.style.whiteSpace = whiteSpace
    span.style.textTransform = 'none'
    span.textContent = text
    control.append(span)
  }
  doc.body.append(control)
  try {
    const output = control.innerText
    const input = runs.map((run) => run.text).join('')
    check(
      output.replace(/[ \t\r\n]/g, '') === input.replace(/[ \t\r\n]/g, ''),
      'Whitespace observation changed a source character.'
    )
    return { input, output }
  } finally {
    control.remove()
  }
}
export async function run() {
  const views = []
  try {
    const plainOne = await createView(false),
      plainTwo = await createView(false)
    views.push(plainOne, plainTwo)
    plainOne.doc.getElementById('link').focus()
    const divergentFocus = [plainOne.inspect().focusMargin, plainTwo.inspect().focusMargin]
    check(
      divergentFocus[0] === '19px' && divergentFocus[1] === '0px',
      'Native focus comparison changed.'
    )
    plainOne.iframe.remove()
    plainTwo.iframe.remove()

    const semantic = await createView(true),
      display = await createView(true)
    views.push(semantic, display)
    display.iframe.setAttribute('aria-hidden', 'true')
    display.iframe.tabIndex = -1
    const baseline = semantic.inspect()
    const first = [semantic.apply(24), display.apply(24)]
    for (const snapshot of first) {
      check(
        snapshot.ordinarySize === '30px' && snapshot.beforeSize === '15px',
        'Reader priority failed.'
      )
      check(
        snapshot.lineHeight === '54px' && snapshot.originalAttributeMatch === '3px',
        'Inline override or source attribute projection failed.'
      )
      check(
        snapshot.graphicWidth === baseline.graphicWidth &&
          snapshot.graphicFont === '16px' &&
          snapshot.graphicColor === baseline.graphicColor &&
          snapshot.rootSize === '16px',
        'A graphic inherited a reader size or color.'
      )
      check(
        snapshot.privateFamily === baseline.privateFamily && snapshot.privateSize === '30px',
        'The generated private-use glyph changed its font source.'
      )
      check(
        snapshot.gradient === baseline.gradient && snapshot.captionColor === baseline.captionColor,
        'The authored paint relationship changed.'
      )
    }
    const second = [semantic.apply(20), display.apply(20)]
    check(
      second.every(
        (snapshot) => snapshot.ordinarySize === '25px' && snapshot.beforeSize === '12.5px'
      ),
      'Reader sizes accumulated across updates.'
    )
    semantic.doc.getElementById('link').focus()
    for (const view of [semantic, display])
      view.doc.getElementById('link').setAttribute(stateName, '')
    const sharedFocus = [semantic.inspect().focusMargin, display.inspect().focusMargin]
    check(
      sharedFocus.every((value) => value === '19px'),
      'Shared focus style diverged.'
    )
    check(
      semantic.doc.activeElement.id === 'link' && display.doc.activeElement.id !== 'link',
      'A style projection became a second native focus.'
    )
    const whitespace = [
      whitespaceControl(semantic.doc, [
        { text: 'Straße \n ', whiteSpace: 'normal' },
        { text: 'B', whiteSpace: 'normal' }
      ]),
      whitespaceControl(
        semantic.doc,
        [
          { text: '你\n', whiteSpace: 'normal' },
          { text: '好', whiteSpace: 'normal' }
        ],
        'zh'
      ),
      whitespaceControl(semantic.doc, [{ text: ' A  B\n C ', whiteSpace: 'pre-wrap' }]),
      whitespaceControl(semantic.doc, [
        { text: 'A ', whiteSpace: 'normal' },
        { text: '  B\n', whiteSpace: 'pre-wrap' },
        { text: 'C', whiteSpace: 'normal' }
      ])
    ]
    check(
      whitespace[0].output === 'Straße B' && whitespace[2].output === ' A  B\n C ',
      'The native whitespace control changed its expected behavior.'
    )
    check(semantic.doc.activeElement.id === 'link', 'Whitespace observation moved focus.')
    const visibility = {
      parentHidden: semantic.iframe.contentWindow.getComputedStyle(
        semantic.doc.getElementById('ghost')
      ).visibility,
      childVisible: semantic.iframe.contentWindow.getComputedStyle(
        semantic.doc.getElementById('revealed')
      ).visibility,
      contentsBox: semantic.doc.getElementById('contents').getClientRects().length,
      childBoxes: semantic.doc.getElementById('contained').getClientRects().length
    }
    check(
      visibility.parentHidden === 'hidden' &&
        visibility.childVisible === 'visible' &&
        visibility.contentsBox === 0 &&
        visibility.childBoxes > 0,
      'Visibility eligibility facts changed.'
    )
    check(
      [semantic, display].every(
        (view) => view.inspect().text === 'Straße' && view.inspect().sameTextNode
      ),
      'Source text identity changed during conversion.'
    )
    return {
      baseline,
      first,
      second,
      divergentFocus,
      sharedFocus,
      whitespace,
      visibility,
      oneNativeFocus: true,
      sourceTextIdentityKept: true,
      limits: {
        automaticRoleClassification: false,
        generalPaintContext: false,
        completeWhitespaceMapping: false,
        allPseudoStates: false,
        animations: false,
        fullReader: false,
        realAssistiveTechnology: false
      }
    }
  } finally {
    views.forEach((view) => view.iframe.remove())
  }
}
