// Test the same source map against native HTML parsing and split, wrapped DOM text nodes.
import * as parse5 from './parse5.mjs'
import { createMarkupMapper } from './markup.mjs'
import { markupCases } from './cases.mjs'

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const attrs = (values) =>
  values
    .map((item) => ({
      name: item.name,
      value: item.value,
      namespace: item.namespace ?? '',
      prefix: item.prefix ?? ''
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
function fromParsed(node) {
  if (node.nodeName === '#documentType')
    return { name: '#doctype', value: node.name, publicId: node.publicId, systemId: node.systemId }
  return {
    name: node.nodeName,
    ...(node.namespaceURI ? { namespace: node.namespaceURI } : {}),
    ...(node.attrs ? { attributes: attrs(node.attrs) } : {}),
    ...(node.value !== undefined ? { text: node.value } : {}),
    ...(node.data !== undefined ? { comment: node.data } : {}),
    ...(node.childNodes ? { children: node.childNodes.map(fromParsed) } : {}),
    ...(node.content ? { content: fromParsed(node.content) } : {})
  }
}
function fromNative(node) {
  if (node.nodeType === 10)
    return { name: '#doctype', value: node.name, publicId: node.publicId, systemId: node.systemId }
  if (node.nodeType === 3) return { name: '#text', text: node.data }
  if (node.nodeType === 8) return { name: '#comment', comment: node.data }
  return {
    name: node.nodeType === 1 ? node.localName : node.nodeName.toLowerCase(),
    ...(node.namespaceURI ? { namespace: node.namespaceURI } : {}),
    ...(node.attributes
      ? {
          attributes: attrs(
            [...node.attributes].map((item) => ({
              name: item.localName,
              value: item.value,
              namespace: item.namespaceURI,
              prefix: item.prefix
            }))
          )
        }
      : {}),
    children: [...node.childNodes].map(fromNative),
    ...(node.content ? { content: fromNative(node.content) } : {})
  }
}
function projection(root, width) {
  const owner = document.implementation.createHTMLDocument('Source mapping')
  const fragment = owner.createDocumentFragment()
  const bindings = new Map()
  const reverse = new WeakMap()
  function visit(source, parent) {
    if (source.nodeName === '#text') {
      const segments = []
      for (let start = 0; start < source.value.length; start += width) {
        const wrapper = owner.createElement('span')
        const node = owner.createTextNode(source.value.slice(start, start + width))
        wrapper.append(node)
        parent.append(wrapper)
        segments.push({ start, end: start + node.length, node })
        reverse.set(node, { source, start })
      }
      bindings.set(source, segments)
    } else if (source.tagName) {
      const node = owner.createElementNS(source.namespaceURI, source.tagName)
      parent.append(node)
      source.childNodes?.forEach((child) => visit(child, node.content ?? node))
      source.content?.childNodes.forEach((child) => visit(child, node.content ?? node))
    } else source.childNodes?.forEach((child) => visit(child, parent))
  }
  visit(root, fragment)
  return {
    owner,
    reverse,
    point(source, offset, end = false) {
      const segments = bindings.get(source)
      const selected =
        segments.find(
          (item) => offset >= item.start && (end ? offset <= item.end : offset < item.end)
        ) ?? segments.at(-1)
      return { node: selected.node, offset: offset - selected.start }
    }
  }
}
export async function runMappingBrowser() {
  const maps = await (await fetch(new URL('./maps.json', import.meta.url))).json()
  const parse = createMarkupMapper(parse5, maps)
  const cases = []
  let ranges = 0
  for (const fixture of markupCases) {
    const bytes = new TextEncoder().encode(fixture.source)
    const source = parse(bytes, 'utf-8', 1)
    const native = new DOMParser().parseFromString(fixture.source, 'text/html')
    const parsedTree = fromParsed(source.tree)
    const nativeTree = fromNative(native)
    const nativeTreeMatched = JSON.stringify(parsedTree) === JSON.stringify(nativeTree)
    assert(
      nativeTreeMatched || fixture.name === 'select-filtering',
      'An unreviewed native parser difference occurred: ' + fixture.name
    )
    for (const width of [1, 3, 11]) {
      const view = projection(source.tree, width)
      for (const unit of source.units) {
        for (const local of unit.projections) {
          if (!unit.value.length) continue
          const start = view.point(local.node, local.offset)
          const end = view.point(local.node, local.offset + unit.value.length, true)
          const range = view.owner.createRange()
          range.setStart(start.node, start.offset)
          range.setEnd(end.node, end.offset)
          assert(range.toString() === unit.value, 'A split DOM Range changed source text.')
          const sourceBinding = view.reverse.get(start.node)
          const saved = source.fromText(sourceBinding.source, sourceBinding.start + start.offset)
          const restored = source.resolve(saved.byteOffset, saved.textOffset)
          assert(
            restored.projections.some(
              (item) => item.node === local.node && item.offset === local.offset
            ),
            'An injected wrapper changed the saved address.'
          )
          ranges++
        }
      }
    }
    cases.push({
      name: fixture.name,
      nativeTreeMatched,
      splitWidths: [1, 3, 11],
      ...(!nativeTreeMatched ? { parsedTree, nativeTree } : {})
    })
  }
  return { cases, checkedRanges: ranges, fullReader: false, visualLayoutChecked: false }
}
