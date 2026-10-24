// Small source-address mechanism specimen; whole fixtures are retained only for this proof.
export class SourceFailure extends Error {
  constructor(reason) {
    super('The source address cannot be resolved.')
    this.reason = reason
  }
}
const fail = (reason) => {
  throw new SourceFailure(reason)
}
export function requireBoundary(text, offset) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > text.length) fail('invalidBoundary')
  const before = text.charCodeAt(offset - 1),
    after = text.charCodeAt(offset)
  if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff)
    fail('invalidBoundary')
}
export function decode(bytes, encoding, chunkSize) {
  const decoder = new TextDecoder(encoding)
  if (decoder.encoding !== encoding) fail('noncanonicalEncoding')
  let text = '',
    chunks = 0
  for (let start = 0; start < bytes.length; start += chunkSize) {
    text += decoder.decode(bytes.subarray(start, start + chunkSize), { stream: true })
    chunks++
  }
  text += decoder.decode()
  return { text, chunks }
}

export function parseXml(text) {
  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (
    document.getElementsByTagNameNS(
      'http://www.mozilla.org/newlayout/xml/parsererror.xml',
      'parsererror'
    ).length ||
    document.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'parsererror').length ||
    document.documentElement?.localName === 'parsererror'
  )
    fail('invalidDocument')
  if (document.doctype?.systemId || document.doctype?.publicId) fail('externalDtd')
  const root = document.documentElement
  if (
    root?.localName !== 'FictionBook' ||
    root.namespaceURI !== 'http://www.gribuser.ru/xml/fictionbook/2.0'
  )
    fail('invalidDocument')
  function element(node) {
    const children = []
    for (const child of node.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) children.push(element(child))
      else if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
        if (!child.data) continue
        if (children.at(-1)?.kind === 'text') children.at(-1).text += child.data
        else children.push({ kind: 'text', text: child.data })
      }
    }
    return { kind: 'element', name: node.localName, namespace: node.namespaceURI, children }
  }
  return element(root)
}

export function createModel(format, source, encoding) {
  let closed = false
  let tree = format === 'txt' ? { kind: 'text', text: source } : source
  const nodes = new Map(),
    texts = [],
    elements = []
  const key = (path) => JSON.stringify(path)
  function visit(node, path) {
    const entry = { ...node, path }
    nodes.set(key(path), entry)
    if (node.kind === 'text') texts.push(entry)
    else {
      elements.push(entry)
      node.children.forEach((child, index) => visit(child, [...path, index]))
    }
  }
  visit(tree, [])
  function requireOpen() {
    if (closed) fail('closed')
  }
  function locate(anchor) {
    requireOpen()
    if (format === 'txt') {
      if (anchor.type !== 'textOffset' || anchor.encoding !== encoding) fail('wrongEncoding')
      requireBoundary(tree.text, anchor.offset)
      return { entry: nodes.get(key([])), offset: anchor.offset }
    }
    if (
      anchor.type !== 'xmlNode' ||
      !Array.isArray(anchor.nodePath) ||
      anchor.nodePath.some((index) => !Number.isSafeInteger(index) || index < 0)
    )
      fail('missingNode')
    const entry = nodes.get(key(anchor.nodePath))
    if (!entry) fail('missingNode')
    if (entry.kind === 'text') requireBoundary(entry.text, anchor.textOffset)
    else if (anchor.textOffset !== undefined) fail('invalidBoundary')
    return { entry, offset: anchor.textOffset }
  }
  function anchor(entry, offset) {
    requireOpen()
    return format === 'txt'
      ? { type: 'textOffset', encoding, offset }
      : {
          type: 'xmlNode',
          nodePath: [...entry.path],
          ...(entry.kind === 'text' ? { textOffset: offset } : {})
        }
  }
  return {
    tree,
    texts,
    elements,
    key,
    locate,
    anchor,
    requireOpen,
    close() {
      closed = true
      nodes.clear()
      texts.length = 0
      elements.length = 0
      tree = null
      this.tree = null
    },
    get closed() {
      return closed
    }
  }
}

export function createView(model, fragmentSize) {
  const root = document.createElement('div')
  root.style.whiteSpace = 'pre-wrap'
  const fragments = new Map(),
    elements = new Map()
  let reverse = new WeakMap(),
    disposed = false
  const decorate = (parent) => {
    const node = document.createElement('span')
    node.dataset.decoration = 'true'
    node.textContent = '◆'
    parent.append(node)
  }
  function render(source, path, parent) {
    const key = model.key(path)
    if (source.kind === 'element') {
      const wrapper = document.createElement('div')
      elements.set(key, wrapper)
      reverse.set(wrapper, { path, kind: 'element' })
      parent.append(wrapper)
      decorate(wrapper)
      source.children.forEach((child, index) => render(child, [...path, index], wrapper))
      decorate(wrapper)
      return
    }
    const parts = []
    let start = 0
    do {
      let end = Math.min(source.text.length, start + fragmentSize)
      // Display fragments keep complete scalar values even when input byte chunks do not.
      if (
        end < source.text.length &&
        source.text.charCodeAt(end - 1) >= 0xd800 &&
        source.text.charCodeAt(end - 1) <= 0xdbff &&
        source.text.charCodeAt(end) >= 0xdc00 &&
        source.text.charCodeAt(end) <= 0xdfff
      )
        end++
      const wrapper = document.createElement(parts.length % 2 ? 'mark' : 'span')
      const text = document.createTextNode(source.text.slice(start, end))
      wrapper.append(text)
      parent.append(wrapper)
      parts.push({ node: text, start, end })
      reverse.set(text, { path, kind: 'text', start })
      decorate(parent)
      start = end
    } while (start < source.text.length)
    fragments.set(key, parts)
  }
  render(model.tree, [], root)
  document.body.append(root)
  function requireActive() {
    model.requireOpen()
    if (disposed) fail('closed')
  }
  function resolve(anchor) {
    requireActive()
    const { entry, offset } = model.locate(anchor)
    if (entry.kind === 'element') return { node: elements.get(model.key(entry.path)), offset: 0 }
    const part = fragments
      .get(model.key(entry.path))
      .find((part) => offset >= part.start && offset <= part.end)
    if (!part) fail('missingNode')
    return { node: part.node, offset: offset - part.start }
  }
  function capture(node, offset) {
    requireActive()
    const mapped = reverse.get(node)
    if (!mapped) fail('noSource')
    let entryAnchor
    if (mapped.kind === 'element') {
      if (offset !== 0) fail('invalidBoundary')
      entryAnchor = { type: 'xmlNode', nodePath: mapped.path }
    } else {
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > node.length)
        fail('invalidBoundary')
      const entry = model.texts.find((item) => model.key(item.path) === model.key(mapped.path))
      entryAnchor = model.anchor(entry, mapped.start + offset)
    }
    model.locate(entryAnchor)
    return entryAnchor
  }
  function rangeText(start, end) {
    const from = resolve(start),
      to = resolve(end)
    const range = document.createRange()
    range.setStart(from.node, from.offset)
    range.setEnd(to.node, to.offset)
    const copy = range.cloneContents()
    copy.querySelectorAll('[data-decoration]').forEach((node) => node.remove())
    return copy.textContent
  }
  return {
    root,
    resolve,
    capture,
    rangeText,
    dispose() {
      disposed = true
      root.remove()
      root.replaceChildren()
      fragments.clear()
      elements.clear()
      reverse = new WeakMap()
    },
    get retainedFragments() {
      return fragments.size + elements.size
    }
  }
}
