// Resolve CFI structure against the unmodified XML graph, preserving occurrence and terminal data.
export class CfiFailure extends Error {
  constructor(reason) {
    super('The CFI cannot be resolved.')
    this.reason = reason
  }
}
const fail = (reason) => {
  throw new CfiFailure(reason)
}
const escaped = new Set('^[](),;=')
const unescape = (text) =>
  text.replace(/\^([\s\S])/g, (_, character) => {
    if (!escaped.has(character)) fail('syntax')
    return character
  })
function splitEscaped(value, separator) {
  const output = ['']
  for (let index = 0; index < value.length; index++) {
    const character = value[index]
    if (character === '^') {
      if (!escaped.has(value[index + 1])) fail('syntax')
      output[output.length - 1] += character + value[++index]
    } else if (character === separator) output.push('')
    else output[output.length - 1] += character
  }
  return output
}
export function parseCfi(value) {
  if (typeof value !== 'string' || !value.startsWith('epubcfi(') || !value.endsWith(')'))
    fail('syntax')
  if (
    !value.isWellFormed() ||
    [...value].some((character) => {
      const point = character.codePointAt(0)
      return (point < 32 && ![9, 10, 13].includes(point)) || point === 0xfffe || point === 0xffff
    })
  )
    fail('syntax')
  const input = value.slice(8, -1)
  let cursor = 0
  function number(integer) {
    const match = /^(0|[1-9]\d*)(?:\.(\d*[1-9]))?/.exec(input.slice(cursor))
    if (!match || (integer && match[2])) fail('syntax')
    cursor += match[0].length
    const value = Number(match[0])
    if (!Number.isFinite(value) || (integer && !Number.isSafeInteger(value))) fail('syntax')
    return value
  }
  function assertion() {
    if (input[cursor] !== '[') return null
    cursor++
    let text = ''
    for (; cursor < input.length && input[cursor] !== ']'; cursor++) {
      const character = input[cursor]
      if (character === '^') {
        if (!escaped.has(input[cursor + 1])) fail('syntax')
        text += character + input[++cursor]
      } else {
        if ('[()'.includes(character)) fail('syntax')
        text += character
      }
    }
    if (input[cursor++] !== ']' || !text) fail('syntax')
    const [data, ...parameters] = splitEscaped(text, ';')
    if (splitEscaped(data, '=').length > 1) fail('syntax')
    const values = data ? splitEscaped(data, ',').map(unescape) : []
    if (values.length > 2 || (values.length === 2 && !values[1])) fail('syntax')
    const params = parameters.map((item) => {
      const pair = splitEscaped(item, '=')
      if (pair.length !== 2) fail('syntax')
      const name = unescape(pair[0]),
        values = splitEscaped(pair[1], ',').map(unescape)
      if (!name || name.includes(' ') || values.some((value) => !value)) fail('syntax')
      return { name, values }
    })
    return { values, params }
  }
  function local(allowEmpty) {
    const begin = cursor,
      segments = [{ steps: [], offset: null }]
    while (cursor < input.length && input[cursor] !== ',') {
      const segment = segments.at(-1)
      if (input[cursor] === '/') {
        if (segment.offset) fail('syntax')
        cursor++
        segment.steps.push({ index: number(true), assertion: assertion() })
      } else if (input[cursor] === '!') {
        if (segment.offset) fail('syntax')
        cursor++
        segments.push({ steps: [], offset: null })
      } else if (':@~'.includes(input[cursor])) {
        if (segment.offset) fail('syntax')
        const kind = input[cursor++]
        if (kind === ':') segment.offset = { text: number(true) }
        else {
          segment.offset = {}
          if (kind === '~') segment.offset.time = number(false)
          if (kind === '@' || input[cursor] === '@') {
            if (kind !== '@') cursor++
            const x = number(false)
            if (input[cursor++] !== ':') fail('syntax')
            segment.offset.space = [x, number(false)]
          }
        }
        segment.offset.assertion = assertion()
      } else fail('syntax')
    }
    if (cursor === begin && allowEmpty) return { segments, source: '' }
    if (
      cursor === begin ||
      (!allowEmpty && !segments[0].steps.length) ||
      (!segments.at(-1).steps.length && !segments.at(-1).offset)
    )
      fail('syntax')
    return { segments, source: input.slice(begin, cursor) }
  }
  const parent = local(false)
  if (cursor === input.length) return { type: 'point', ...parent }
  cursor++
  const start = local(true)
  if (input[cursor++] !== ',') fail('syntax')
  const end = local(true)
  if (cursor !== input.length || parent.segments.at(-1).offset) fail('syntax')
  return { type: 'range', parent, start, end }
}
export function expandRange(value) {
  const parsed = parseCfi(value)
  if (parsed.type !== 'range') fail('rangeExpected')
  const points = [parsed.start, parsed.end].map(
    (local) => `epubcfi(${parsed.parent.source}${local.source})`
  )
  points.forEach((point) => {
    const full = parseCfi(point)
    if (
      full.segments.some((segment) =>
        [segment.offset?.assertion, ...segment.steps.map((step) => step.assertion)].some((item) =>
          item?.params.some((param) => param.name === 's')
        )
      )
    )
      fail('rangeBias')
  })
  return points
}
export const escapeCfi = (value) => value.replace(/[\^\[\](),;=]/g, '^$&')
const attribute = (node, name) => node.attributes?.find((pair) => pair[0] === name)?.[1]
const id = (node) =>
  attribute(node, 'id') ?? attribute(node, 'http://www.w3.org/XML/1998/namespace\x1fid')

export function createCfiBook(packageName, documents) {
  function indexDocument(tree) {
    let text = ''
    const positions = new Map(),
      parents = new Map()
    function visit(node, parent) {
      if (parent) parents.set(node, parent)
      if (node.kind === 'text') {
        positions.set(node, text.length)
        text += node.text
      } else node.children.forEach((child) => visit(child, node))
    }
    visit(tree)
    return { tree, text, positions, parents }
  }
  const docs = new Map([...documents].map(([name, tree]) => [name, indexDocument(tree)]))
  const packageDoc = docs.get(packageName)
  const spine = packageDoc.tree.children.find((node) => node.name === 'spine')
  const manifest = packageDoc.tree.children.find((node) => node.name === 'manifest')
  const items = spine.children.filter((node) => node.kind === 'element')
  const manifestItems = manifest.children.filter((node) => node.kind === 'element')
  function verifyId(node, assertion) {
    if (
      assertion?.values.length &&
      (assertion.values.length !== 1 || id(node) !== assertion.values[0])
    )
      fail('assertionMismatch')
  }
  function step(node, item) {
    if (node.kind !== 'element') fail('missingNode')
    const elements = node.children.filter((child) => child.kind === 'element')
    if (item.index % 2 === 0) {
      if (item.index === 0 || item.index === elements.length * 2 + 2) {
        if (item.assertion?.values.length) fail('assertionMismatch')
        return { kind: 'boundary', parent: node, side: item.index ? 'end' : 'start' }
      }
      const child = elements[item.index / 2 - 1]
      if (!child) fail('missingNode')
      verifyId(child, item.assertion)
      return child
    }
    let ordinal = 0
    for (const child of node.children) {
      if (child.kind === 'element') ordinal++
      else if (ordinal * 2 + 1 === item.index) return child
    }
    if (item.index > elements.length * 2 + 1) fail('missingNode')
    return { kind: 'text', text: '', virtual: true, parent: node, gap: (item.index - 1) / 2 }
  }
  function resolve(value) {
    const parsed = parseCfi(value)
    if (parsed.type !== 'point') fail('pointExpected')
    if (step(packageDoc.tree, parsed.segments[0].steps[0]) !== spine) fail('invalidPackagePath')
    let documentName = packageName,
      current = packageDoc.tree,
      occurrence = null,
      bias = null
    for (let index = 0; index < parsed.segments.length; index++) {
      const segment = parsed.segments[index]
      for (const [stepIndex, item] of segment.steps.entries()) {
        if (
          item.assertion?.params.some((param) => param.name === 's') &&
          (index < parsed.segments.length - 1 ||
            stepIndex < segment.steps.length - 1 ||
            segment.offset)
        )
          fail('invalidBias')
        current = step(current, item)
        if (current.kind !== 'element' && item.assertion?.values.length) fail('invalidAssertion')
      }
      const terminalAssertion = segment.offset?.assertion ?? segment.steps.at(-1)?.assertion
      for (const param of terminalAssertion?.params ?? [])
        if (param.name === 's') {
          if (param.values.length !== 1 || !['a', 'b'].includes(param.values[0]))
            fail('invalidBias')
          bias = param.values[0]
        }
      if (index < parsed.segments.length - 1) {
        if (current.kind !== 'element' || segment.offset) fail('invalidIndirection')
        let target
        if (documentName === packageName && current.name === 'itemref') {
          occurrence = items.indexOf(current)
          if (occurrence < 0) fail('invalidIndirection')
          const matches = manifestItems.filter((item) => id(item) === attribute(current, 'idref'))
          if (matches.length !== 1) fail('invalidIndirection')
          target = attribute(matches[0], 'href')
        } else if (['iframe', 'embed'].includes(current.name)) target = attribute(current, 'src')
        else if (current.name === 'object') target = attribute(current, 'data')
        else if (['image', 'use'].includes(current.name))
          target =
            attribute(current, 'http://www.w3.org/1999/xlink\x1fhref') ?? attribute(current, 'href')
        if (!target) fail('invalidIndirection')
        const url = new URL(target, 'https://archive.invalid/' + documentName)
        if (url.origin !== 'https://archive.invalid') fail('outsidePublication')
        documentName = decodeURIComponent(url.pathname.slice(1))
        current = docs.get(documentName)?.tree
        if (!current) fail('missingDocument')
        if (url.hash) {
          const matches = []
          const find = (node) => {
            if (id(node) === decodeURIComponent(url.hash.slice(1))) matches.push(node)
            node.children?.forEach(find)
          }
          find(current)
          if (matches.length !== 1) fail('missingNode')
          current = matches[0]
        }
      }
    }
    const offset = parsed.segments.at(-1).offset
    if (offset && 'text' in offset) {
      if (current.kind !== 'text' || offset.text > current.text.length) fail('invalidOffset')
      const before = current.text.charCodeAt(offset.text - 1),
        after = current.text.charCodeAt(offset.text)
      if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff)
        fail('invalidOffset')
      if (offset.assertion?.values.length) {
        const document = docs.get(documentName),
          start = document.positions.get(current)
        if (start === undefined) fail('assertionMismatch')
        const collapse = (value) => value.replace(/[\t\n\r ]+/g, ' ')
        const [prefix, suffix] = offset.assertion.values
        const absolute = start + offset.text
        if (
          (prefix && !collapse(document.text.slice(0, absolute)).endsWith(collapse(prefix))) ||
          (suffix && !collapse(document.text.slice(absolute)).startsWith(collapse(suffix)))
        )
          fail('assertionMismatch')
      }
    } else if (offset) {
      if (
        current.kind !== 'element' ||
        offset.space?.some((number) => number < 0 || number > 100) ||
        (offset.space && bias)
      )
        fail('invalidOffset')
    }
    return {
      documentName,
      occurrence,
      node: current,
      textOffset: offset?.text,
      time: offset?.time,
      space: offset?.space,
      bias
    }
  }
  return { resolve, items, packageDoc, documents: docs }
}
