// Resolve and generate source CFIs within one rendition and its explicit embedding contexts.
import {
  point,
  parseCfi,
  serializeCfi,
  expandRange,
  comparePoints,
  boundedInteger,
  compareNumber,
  bias,
  fail
} from './grammar.mjs'

export const NS = {
  opf: 'http://www.idpf.org/2007/opf',
  html: 'http://www.w3.org/1999/xhtml',
  svg: 'http://www.w3.org/2000/svg',
  xml: 'http://www.w3.org/XML/1998/namespace',
  xlink: 'http://www.w3.org/1999/xlink'
}
export const attr = (node, name, namespace = '') =>
  node.attributes?.find(([key]) => key === (namespace ? namespace + '\x1f' : '') + name)?.[1]
const named = (node, namespace, name) =>
  node?.kind === 'element' && node.namespace === namespace && node.name === name
const elementChildren = (node) => node.children?.filter((child) => child.kind === 'element') ?? []
const ids = (node) => [
  ...new Set(
    [
      ...([NS.html, NS.svg, NS.opf].includes(node.namespace) ? [attr(node, 'id')] : []),
      attr(node, 'id', NS.xml),
      node.declaredId
    ].filter((value) => typeof value === 'string' && value.length)
  )
]
const idAssertion = (node) => (ids(node).length ? { values: [ids(node)[0]], params: [] } : null)
export const requireTextBoundary = (text, offset) => {
  const before = text.charCodeAt(offset - 1),
    after = text.charCodeAt(offset)
  if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff)
    fail('outOfBounds')
}
const textToken = (value) => ({ kind: 'text', value: String(value), assertion: null })
const stepToken = (index, node) => ({
  kind: 'step',
  index: String(index),
  assertion: node ? idAssertion(node) : null
})

function indexXml(resource) {
  const parents = new Map(),
    paths = new Map(),
    byId = new Map(),
    textEntries = [],
    textIndex = new Map()
  const textBounds = new Map()
  function visit(node, parent, path) {
    if (parent) parents.set(node, parent)
    paths.set(node, path)
    if (node.kind === 'text') {
      textIndex.set(node, textEntries.length)
      textEntries.push(node)
      return
    }
    for (const id of ids(node)) byId.set(id, [...(byId.get(id) ?? []), node])
    const start = textEntries.length
    let elements = 0
    for (const child of node.children) {
      const index = child.kind === 'element' ? ++elements * 2 : elements * 2 + 1
      visit(child, node, [...path, stepToken(index, child.kind === 'element' ? child : null)])
    }
    textBounds.set(node, { start, end: textEntries.length })
  }
  visit(resource.tree, null, [])
  return { ...resource, parents, paths, byId, textEntries, textIndex, textBounds }
}

export function createCfiBook(packageName, sourceResources, resolveReference) {
  const resources = new Map(
    [...sourceResources].map(([name, resource]) => [
      name,
      resource.tree ? indexXml({ ...resource, name }) : { ...resource, name }
    ])
  )
  const pkg = resources.get(packageName)
  if (!named(pkg?.tree, NS.opf, 'package')) fail('invalidPackage')
  const spine = elementChildren(pkg.tree).filter((node) => named(node, NS.opf, 'spine'))
  const manifests = elementChildren(pkg.tree).filter((node) => named(node, NS.opf, 'manifest'))
  if (spine.length !== 1 || manifests.length !== 1) fail('invalidPackage')
  const spineNode = spine[0]
  const items = elementChildren(spineNode).filter((node) => named(node, NS.opf, 'itemref'))
  const manifest = elementChildren(manifests[0]).filter((node) => named(node, NS.opf, 'item'))
  const packageContext = { document: pkg, root: pkg.tree, occurrence: null, prefix: [] }
  const sameId = (node, assertion) => {
    if (
      assertion?.values.length &&
      (assertion.values.length !== 1 || !ids(node).includes(assertion.values[0]))
    )
      fail('assertionMismatch')
  }
  function pathFrom(context, node) {
    const path = context.document.paths.get(node)
    const rootPath = context.document.paths.get(context.root)
    if (!path || !rootPath || (node !== context.root && !isWithin(context, node)))
      fail('wrongContext')
    return path.slice(rootPath.length)
  }
  function isWithin(context, node) {
    for (let current = node; current; current = context.document.parents.get(current))
      if (current === context.root) return true
    return false
  }
  function follow(context, node) {
    let href
    let occurrence = context.occurrence
    if (
      context.document === pkg &&
      named(node, NS.opf, 'itemref') &&
      pkg.parents.get(node) === spineNode
    ) {
      occurrence = items.indexOf(node)
      const matches = manifest.filter((item) => attr(item, 'id') === attr(node, 'idref'))
      if (occurrence < 0 || matches.length !== 1) fail('invalidIndirection')
      href = attr(matches[0], 'href')
    } else if (node.namespace === NS.html) {
      if (['iframe', 'embed'].includes(node.name)) href = attr(node, 'src')
      else if (node.name === 'object') href = attr(node, 'data')
    } else if (node.namespace === NS.svg && ['image', 'use'].includes(node.name))
      href = attr(node, 'href', NS.xlink)
    if (!href) fail('invalidIndirection')
    const reference = resolveReference(context.document.name, node, href)
    const document = resources.get(reference.name)
    if (!document) fail('missingDocument')
    let root = document.tree ?? document
    if (reference.fragment) {
      if (!document.tree) fail('missingTarget')
      const matches = document.byId.get(reference.fragment) ?? []
      if (matches.length !== 1) fail(matches.length ? 'ambiguous' : 'missingTarget')
      root = matches[0]
    }
    const prefix = [...context.prefix, ...pathFrom(context, node), { kind: 'indirect' }]
    return { document, root, occurrence, prefix }
  }
  function contextForOccurrence(occurrence) {
    if (!Number.isInteger(occurrence) || !items[occurrence]) fail('outOfBounds')
    return follow(packageContext, items[occurrence])
  }
  function contextForEmbedding(context, node) {
    return follow(context, node)
  }
  function step(context, node, token) {
    if (node.kind !== 'element') fail('missingTarget')
    const elements = elementChildren(node)
    const index = boundedInteger(token.index, elements.length * 2 + 2)
    if (index % 2 === 0) {
      if (index === 0 || index === elements.length * 2 + 2) {
        if (token.assertion?.values.length) fail('invalidAssertion')
        return { kind: 'boundary', parent: node, edge: index === 0 ? 'start' : 'end' }
      }
      const child = elements[index / 2 - 1]
      if (!child) fail('missingTarget')
      sameId(child, token.assertion)
      return child
    }
    if (token.assertion?.values.length) fail('invalidAssertion')
    let ordinal = 0
    for (const child of node.children) {
      if (child.kind === 'element') ordinal++
      else if (ordinal * 2 + 1 === index) return child
    }
    return { kind: 'text', virtual: true, parent: node, gap: (index - 1) / 2, text: '' }
  }
  function neighboringText(context, node, offset, direction, size) {
    let index = context.document.textIndex.get(node)
    if (node.virtual) {
      const next = elementChildren(node.parent)[node.gap]
      index = next
        ? context.document.textBounds.get(next).start
        : context.document.textBounds.get(node.parent).end
    }
    if (index === undefined) fail('missingTarget')
    let position = offset
    let text = ''
    if (direction < 0 && position === 0) {
      index--
      position = context.document.textEntries[index]?.text.length ?? 0
    }
    while (index >= 0 && index < context.document.textEntries.length && text.length < size) {
      const value = context.document.textEntries[index].text
      if (direction < 0) {
        if (position === 0) {
          index--
          position = context.document.textEntries[index]?.text.length ?? 0
          continue
        }
        const character = value[--position]
        if (/[\t\n\r ]/.test(character)) {
          if (!text.startsWith(' ')) text = ' ' + text
        } else text = character + text
      } else {
        if (position === value.length) {
          index++
          position = 0
          continue
        }
        const character = value[position++]
        if (/[\t\n\r ]/.test(character)) {
          if (!text.endsWith(' ')) text += ' '
        } else text += character
      }
    }
    return text
  }
  function verifyText(context, node, text, offset, assertion, alternative) {
    if (!assertion?.values.length) return
    const collapse = (value) => value.replace(/[\t\n\r ]+/g, ' ')
    const [before = '', after = ''] = assertion.values.map(collapse)
    const left = alternative
      ? collapse(text.slice(0, offset))
      : neighboringText(context, node, offset, -1, before.length)
    const right = alternative
      ? collapse(text.slice(offset))
      : neighboringText(context, node, offset, 1, after.length)
    if (!left.endsWith(before) || !right.startsWith(after)) fail('assertionMismatch')
  }
  function resolve(value, { mode = 'standard' } = {}) {
    const parsed = point(value)
    const selectedBias = bias(parsed)
    let context = packageContext
    let current = pkg.tree
    let terminal = null
    for (let index = 0; index < parsed.tokens.length; index++) {
      const token = parsed.tokens[index]
      if (token.kind === 'step') {
        current = step(context, current, token)
        if (index === 0 && mode === 'standard' && current !== spineNode) fail('invalidPackagePath')
      } else if (token.kind === 'indirect') {
        context = follow(context, current)
        current = context.root
      } else terminal = token
    }
    const result = { context, node: current, bias: selectedBias, value: serializeCfi(parsed) }
    if (!terminal && current.kind === 'text') terminal = textToken(0)
    if (terminal?.kind === 'text') {
      const alternative = named(current, NS.html, 'img') && attr(current, 'alt') !== undefined
      const text = alternative
        ? attr(current, 'alt')
        : current.kind === 'text'
          ? current.text
          : null
      if (text === null) fail('invalidOffset')
      const offset = boundedInteger(terminal.value, text.length)
      // Kana's persisted text boundaries do not divide a Unicode scalar.
      requireTextBoundary(text, offset)
      verifyText(context, current, text, offset, terminal.assertion, alternative)
      return { ...result, kind: alternative ? 'alt' : 'text', offset }
    }
    if (terminal?.kind === 'media') {
      if (current.kind !== 'element' && current.kind !== 'resource') fail('invalidOffset')
      if (terminal.assertion?.values.length) fail('invalidAssertion')
      if (
        terminal.space &&
        (compareNumber(terminal.space.x, '100') > 0 || compareNumber(terminal.space.y, '100') > 0)
      )
        fail('outOfBounds')
      let media = current.kind === 'resource' ? current.media : null
      if (current.namespace === NS.html && ['object', 'embed'].includes(current.name)) {
        const referenced = follow(context, current)
        media = referenced.document.media ?? (referenced.root.namespace === NS.svg ? 'image' : null)
      }
      const visual =
        ['image', 'video'].includes(media) ||
        (current.namespace === NS.html && ['img', 'video'].includes(current.name)) ||
        (current.namespace === NS.svg && ['svg', 'image', 'use'].includes(current.name))
      const timed =
        ['audio', 'video'].includes(media) ||
        (current.namespace === NS.html && ['audio', 'video'].includes(current.name))
      if ((terminal.space && !visual) || (terminal.time !== null && !timed)) fail('invalidOffset')
      return { ...result, kind: 'media', time: terminal.time, space: terminal.space }
    }
    return { ...result, kind: current.kind }
  }
  function generate(target) {
    const { context, node } = target
    let local
    if (node.virtual) {
      local = [...pathFrom(context, node.parent), stepToken(node.gap * 2 + 1)]
    } else if (node.kind === 'boundary') {
      const index = node.edge === 'start' ? 0 : elementChildren(node.parent).length * 2 + 2
      local = [...pathFrom(context, node.parent), stepToken(index)]
    } else local = node === context.root && !context.document.tree ? [] : pathFrom(context, node)
    const tokens = [...context.prefix, ...local]
    if (target.kind === 'text' || target.kind === 'alt') tokens.push(textToken(target.offset))
    if (target.kind === 'media')
      tokens.push({
        kind: 'media',
        time: target.time ?? null,
        space: target.space ?? null,
        assertion: null
      })
    if (!tokens.length || tokens.at(-1).kind === 'indirect') fail('rootNeedsTerminal')
    if (target.bias) {
      const last = (tokens[tokens.length - 1] = { ...tokens.at(-1) })
      last.assertion = {
        values: last.assertion?.values ?? [],
        params: [{ name: 's', values: [target.bias] }]
      }
    }
    const value = serializeCfi({ kind: 'point', tokens })
    resolve(value)
    return value
  }
  function readingPath(target) {
    if (target.context.occurrence === null) fail('notRenderable')
    return attr(items[target.context.occurrence], 'linear') === 'no'
      ? 'independent:' + target.context.occurrence
      : 'main'
  }
  function resolveRange(value, requireText = false) {
    const [start, end] = expandRange(value)
    const order = comparePoints(start, end)
    if (order > 0 || (requireText && order === 0)) fail('invalidRange')
    const targets = [resolve(start), resolve(end)]
    if (
      requireText &&
      (targets.some((target) => !['text', 'alt'].includes(target.kind)) ||
        readingPath(targets[0]) !== readingPath(targets[1]))
    )
      fail('notRenderable')
    return { start: targets[0], end: targets[1], values: [start, end] }
  }
  function resolveLink(value, options) {
    const parsed = parseCfi(value)
    if (parsed.kind === 'point') return resolve(parsed, options)
    const [start, end] = expandRange(parsed)
    if (comparePoints(start, end) > 0) fail('invalidRange')
    return resolve(start, options)
  }
  return {
    resources,
    pkg,
    spine: spineNode,
    items,
    contextForOccurrence,
    contextForEmbedding,
    resolve,
    generate,
    readingPath,
    resolveRange,
    resolveLink,
    pathFrom
  }
}
