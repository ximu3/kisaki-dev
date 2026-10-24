// Bind native nodes to source facts explicitly; wrapper positions are never CFI steps.
import { fail, serializeTokens } from './grammar.mjs'
import { requireTextBoundary } from './book.mjs'

export function project(context, width) {
  const owner = document.implementation.createHTMLDocument('CFI binding proof')
  const fragment = owner.createDocumentFragment()
  const elements = new Map()
  const texts = new Map()
  const reverse = new WeakMap()
  function visit(source, parent) {
    if (source.kind === 'text') {
      const segments = []
      for (let start = 0; start < source.text.length; start += width) {
        const wrapper = owner.createElement('span')
        const node = owner.createTextNode(source.text.slice(start, start + width))
        wrapper.append(node)
        parent.append(wrapper)
        segments.push({ node, start, end: start + node.length })
        reverse.set(node, { source, start })
      }
      texts.set(source, segments)
      return
    }
    const node = owner.createElementNS(source.namespace || null, source.name)
    elements.set(source, node)
    parent.append(node)
    for (const child of source.children) visit(child, node)
  }
  visit(context.root, fragment)
  const root = elements.get(context.root)
  const decoration = owner.createElement('span')
  decoration.textContent = 'Generated decoration'
  root.append(decoration)
  const position = (parent, child, after = false) => ({
    node: parent,
    offset: Array.prototype.indexOf.call(parent.childNodes, child) + (after ? 1 : 0)
  })
  return {
    owner,
    decoration: decoration.firstChild,
    elements,
    point(target) {
      if (
        target.context.root !== context.root ||
        target.context.occurrence !== context.occurrence ||
        target.context.document !== context.document ||
        serializeTokens(target.context.prefix) !== serializeTokens(context.prefix)
      )
        fail('wrongContext')
      if (target.kind === 'alt' || target.kind === 'media' || target.kind === 'resource')
        fail('notRenderable')
      if (target.node.virtual) {
        const parent = elements.get(target.node.parent)
        const siblings = target.node.parent.children.filter((node) => node.kind === 'element')
        const next = siblings[target.node.gap]
        const previous = siblings[target.node.gap - 1]
        return next
          ? position(parent, elements.get(next))
          : previous
            ? position(parent, elements.get(previous), true)
            : { node: parent, offset: 0 }
      }
      if (target.kind === 'text') {
        requireTextBoundary(target.node.text, target.offset)
        const segments = texts.get(target.node)
        if (!segments?.length) fail('notRenderable')
        const selected =
          target.bias === 'b'
            ? segments.find((item) => target.offset >= item.start && target.offset <= item.end)
            : (segments.find((item) => target.offset >= item.start && target.offset < item.end) ??
              segments.at(-1))
        return { node: selected.node, offset: target.offset - selected.start }
      }
      if (target.node.kind === 'boundary') {
        const parent = elements.get(target.node.parent)
        return {
          node: parent,
          offset:
            target.node.edge === 'start' ? 0 : parent.childNodes.length - (parent === root ? 1 : 0)
        }
      }
      const element = elements.get(target.node)
      if (!element) fail('notRenderable')
      return position(element.parentNode, element)
    },
    capture(point) {
      const binding = reverse.get(point.node)
      if (!binding) fail('notRenderable')
      if (!Number.isInteger(point.offset) || point.offset < 0 || point.offset > point.node.length)
        fail('outOfBounds')
      const offset = binding.start + point.offset
      requireTextBoundary(binding.source.text, offset)
      return { context, node: binding.source, kind: 'text', offset }
    }
  }
}
