// Compare native break values and a measured spacer without claiming a complete paginator.
const stage = document.querySelector('#stage')
const modes = ['horizontal-tb', 'vertical-rl', 'vertical-lr']
const declarations = [
  'break-before:column',
  'break-before:page',
  'break-before:always',
  'break-before:all',
  'page-break-before:always',
  '-webkit-column-break-before:always',
  'break-before:left',
  'break-before:right',
  'column-span:all'
]

async function mount(mode, declaration = '', margin = 0) {
  const frame = document.createElement('iframe')
  frame.sandbox = 'allow-scripts allow-same-origin'
  frame.style.cssText = 'width:280px;height:400px;border:0'
  const ready = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
  frame.srcdoc = `<!doctype html><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src 'none';style-src 'unsafe-inline'">
<style>html,body{margin:0;padding:0;writing-mode:${mode}}html{overflow:hidden}
#flow{width:280px;height:400px;column-count:1;column-gap:20px;column-fill:auto;counter-reset:n 8}
.block{block-size:60px;font:20px/1 monospace}
#flow>.block{counter-increment:n}#flow>.block::before{content:counter(n) ':'}
#flow>.block:nth-child(2){color:red}#flow>.block+.block{font-weight:bold}
#b{margin-block-start:${margin}px;${declaration}}</style>
<div id="flow"><div class="block" id="a">A</div><div class="block" id="b">B</div></div>`
  stage.replaceChildren(frame)
  await ready
  return frame.contentDocument
}

function observe(doc, mode) {
  const a = doc.getElementById('a'),
    b = doc.getElementById('b')
  const first = a.getBoundingClientRect(),
    second = b.getBoundingClientRect()
  const text = doc.createRange()
  text.selectNodeContents(b)
  const textRect = text.getBoundingClientRect()
  const style = doc.defaultView.getComputedStyle(b)
  const flow = doc.getElementById('flow')
  return {
    first: first.toJSON(),
    second: second.toJSON(),
    dx: second.x - first.x,
    dy: second.y - first.y,
    breakBefore: style.breakBefore,
    marginBlockStart: style.marginBlockStart,
    color: style.color,
    fontWeight: style.fontWeight,
    textInset: mode === 'horizontal-tb' ? textRect.x - second.x : textRect.y - second.y,
    sourceText: flow.textContent,
    childIds: [...flow.children].map((node) => node.id),
    sourceSiblingSelector: b.matches('#flow > .block + .block:nth-child(2)'),
    targetBlockOffset:
      mode === 'horizontal-tb'
        ? second.top
        : mode === 'vertical-rl'
          ? 280 - second.right
          : second.left,
    fragmentIndex: Math.floor(
      ((mode === 'horizontal-tb' ? second.left : second.top) + 0.1) /
        (mode === 'horizontal-tb' ? 300 : 420)
    )
  }
}

async function run() {
  const native = [],
    spacers = []
  for (const mode of modes) {
    for (const declaration of declarations) {
      const doc = await mount(mode, declaration)
      const [property, value] = declaration.split(':')
      native.push({
        mode,
        declaration,
        syntaxSupported: CSS.supports(property, value),
        result: observe(doc, mode)
      })
    }
    for (const margin of [0, 20]) {
      const doc = await mount(mode, 'break-before:column', margin)
      const nativeReference = observe(doc, mode)
      const flow = doc.getElementById('flow')
      const a = doc.getElementById('a'),
        b = doc.getElementById('b')
      b.style.breakBefore = 'auto'
      const before = observe(doc, mode)
      const shadow = flow.attachShadow({ mode: 'open', slotAssignment: 'manual' })
      const firstSlot = doc.createElement('slot'),
        secondSlot = doc.createElement('slot')
      firstSlot.style.display = 'contents'
      secondSlot.style.display = 'contents'
      const gap = doc.createElement('div')
      gap.setAttribute('aria-hidden', 'true')
      gap.style.cssText = `display:block;box-sizing:border-box;block-size:${mode === 'horizontal-tb' ? 340 : 220}px;inline-size:0;margin:0;padding:0;border:0;font-size:0;line-height:0;overflow:hidden;pointer-events:none`
      shadow.append(firstSlot, gap, secondSlot)
      firstSlot.assign(a)
      secondSlot.assign(b)
      spacers.push({
        mode,
        margin,
        nativeReference,
        before,
        after: observe(doc, mode),
        manualAssignment: shadow.slotAssignment,
        assignedSourceNodes: firstSlot.assignedNodes().length + secondSlot.assignedNodes().length,
        generalFragmentationImplemented: false
      })
    }
  }
  const hosts = []
  for (const tag of ['div', 'section', 'ul', 'ol', 'li', 'table', 'tbody', 'tr', 'td']) {
    const element = document.createElement(tag)
    try {
      element.attachShadow({ mode: 'open', slotAssignment: 'manual' })
      hosts.push({ tag, supported: true })
    } catch (error) {
      hosts.push({ tag, supported: false, errorName: error.name })
    }
  }
  stage.replaceChildren()
  return { native, spacers, hosts, fullReaderExecuted: false, publicationTested: false }
}

window.breakProof = { run }
