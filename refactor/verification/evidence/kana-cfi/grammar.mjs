// Preserve the complete CFI value; numeric ordering never rounds decimal source tokens.
export class CfiFailure extends Error {
  constructor(reason) {
    super('The CFI cannot be resolved.')
    this.reason = reason
  }
}
export const fail = (reason) => {
  throw new CfiFailure(reason)
}
const special = new Set('^[](),;=')
export const escapeCfi = (value) => value.replace(/[\^[\](),;=]/g, '^$&')

function split(value, delimiter) {
  const parts = ['']
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '^') {
      if (!special.has(value[index + 1])) fail('syntax')
      parts[parts.length - 1] += value[index] + value[++index]
    } else if (value[index] === delimiter) parts.push('')
    else parts[parts.length - 1] += value[index]
  }
  return parts
}
function decode(value) {
  let output = ''
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '^') {
      if (!special.has(value[index + 1])) fail('syntax')
      output += value[++index]
    } else {
      if (special.has(value[index])) fail('syntax')
      output += value[index]
    }
  }
  return output
}
export function parseCfi(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('epubcfi(') ||
    !value.endsWith(')') ||
    !value.isWellFormed()
  )
    fail('syntax')
  for (const character of value) {
    const cp = character.codePointAt(0)
    if ((cp < 32 && ![9, 10, 13].includes(cp)) || cp === 0xfffe || cp === 0xffff) fail('syntax')
  }
  const input = value.slice(8, -1)
  let cursor = 0
  function number(integer) {
    const match = (integer ? /^(?:0|[1-9]\d*)/ : /^(?:0|[1-9]\d*)(?:\.\d*[1-9])?/).exec(
      input.slice(cursor)
    )
    if (!match) fail('syntax')
    cursor += match[0].length
    return match[0]
  }
  function assertion() {
    if (input[cursor] !== '[') return null
    cursor++
    let raw = ''
    while (cursor < input.length && input[cursor] !== ']') {
      const character = input[cursor++]
      if (character === '^') {
        if (!special.has(input[cursor])) fail('syntax')
        raw += '^' + input[cursor++]
      } else {
        if ('[()'.includes(character)) fail('syntax')
        raw += character
      }
    }
    if (input[cursor++] !== ']' || !raw) fail('syntax')
    const [data, ...parameters] = split(raw, ';')
    const values = data ? split(data, ',').map(decode) : []
    if (values.length > 2 || (values.length === 2 && !values[1])) fail('syntax')
    const params = parameters.map((item) => {
      const pair = split(item, '=')
      if (pair.length !== 2) fail('syntax')
      const name = decode(pair[0])
      const values = split(pair[1], ',').map(decode)
      if (!name || name.includes(' ') || values.some((value) => !value)) fail('syntax')
      return { name, values }
    })
    if (!values.length && !params.length) fail('syntax')
    return { values, params }
  }
  function local(requireStep) {
    const tokens = []
    let afterIndirect = false
    while (cursor < input.length && input[cursor] !== ',') {
      const character = input[cursor]
      if (character === '/') {
        cursor++
        tokens.push({ kind: 'step', index: number(true), assertion: assertion() })
        afterIndirect = false
      } else if (character === '!') {
        if (afterIndirect) fail('syntax')
        cursor++
        tokens.push({ kind: 'indirect' })
        afterIndirect = true
      } else if (':~@'.includes(character)) {
        cursor++
        let token
        if (character === ':') token = { kind: 'text', value: number(true) }
        else {
          token = { kind: 'media', time: null, space: null }
          if (character === '~') token.time = number(false)
          if (character === '@' || input[cursor] === '@') {
            if (character !== '@') cursor++
            const x = number(false)
            if (input[cursor++] !== ':') fail('syntax')
            token.space = { x, y: number(false) }
          }
        }
        token.assertion = assertion()
        tokens.push(token)
        afterIndirect = false
        break
      } else fail('syntax')
    }
    if (afterIndirect || (requireStep && tokens[0]?.kind !== 'step')) fail('syntax')
    return tokens
  }
  const parent = local(true)
  if (cursor === input.length) return { kind: 'point', tokens: parent }
  if (input[cursor++] !== ',' || parent.at(-1)?.kind !== 'step') fail('syntax')
  const start = local(false)
  if (input[cursor++] !== ',') fail('syntax')
  const end = local(false)
  if (cursor !== input.length) fail('syntax')
  return { kind: 'range', parent, start, end }
}
const writeAssertion = (item) =>
  item
    ? '[' +
      item.values.map(escapeCfi).join(',') +
      item.params
        .map(({ name, values }) => ';' + escapeCfi(name) + '=' + values.map(escapeCfi).join(','))
        .join('') +
      ']'
    : ''
export function serializeTokens(tokens) {
  return tokens
    .map((token) => {
      if (token.kind === 'indirect') return '!'
      if (token.kind === 'step') return '/' + token.index + writeAssertion(token.assertion)
      if (token.kind === 'text') return ':' + token.value + writeAssertion(token.assertion)
      return (
        (token.time !== null ? '~' + token.time : '') +
        (token.space ? '@' + token.space.x + ':' + token.space.y : '') +
        writeAssertion(token.assertion)
      )
    })
    .join('')
}
export function serializeCfi(cfi) {
  const body =
    cfi.kind === 'point'
      ? serializeTokens(cfi.tokens)
      : [cfi.parent, cfi.start, cfi.end].map(serializeTokens).join(',')
  return `epubcfi(${body})`
}
export function point(value) {
  const parsed = typeof value === 'string' ? parseCfi(value) : value
  if (parsed.kind !== 'point') fail('pointExpected')
  return parsed
}
export function expandRange(value) {
  const parsed = typeof value === 'string' ? parseCfi(value) : value
  if (parsed.kind !== 'range') fail('rangeExpected')
  const tokens = [parsed.parent, parsed.start, parsed.end].flat()
  if (tokens.some((token) => token.assertion?.params.some((item) => item.name === 's')))
    fail('rangeBias')
  return [parsed.start, parsed.end].map((end) => {
    const result = serializeCfi({ kind: 'point', tokens: [...parsed.parent, ...end] })
    point(result)
    return result
  })
}
export function compareInteger(a, b) {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1
  return a === b ? 0 : a < b ? -1 : 1
}
export function compareNumber(a, b) {
  const [wholeA, fractionA = ''] = a.split('.')
  const [wholeB, fractionB = ''] = b.split('.')
  const whole = compareInteger(wholeA, wholeB)
  if (whole) return whole
  const length = Math.max(fractionA.length, fractionB.length)
  const left = fractionA.padEnd(length, '0')
  const right = fractionB.padEnd(length, '0')
  return left === right ? 0 : left < right ? -1 : 1
}
export function boundedInteger(value, maximum, reason = 'outOfBounds') {
  if (compareInteger(value, String(maximum)) > 0) fail(reason)
  return Number(value)
}
function comparisonTokens(value) {
  const tokens = [...point(value).tokens]
  const last = tokens.at(-1)
  if (last.kind === 'step' && Number(last.index.at(-1)) % 2 === 1)
    tokens.push({ kind: 'text', value: '0', assertion: null })
  return tokens
}
export function comparePoints(a, b) {
  const left = comparisonTokens(a)
  const right = comparisonTokens(b)
  const rank = { text: 0, step: 1, media: 2, indirect: 3 }
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const one = left[index],
      two = right[index]
    if (one.kind !== two.kind) return rank[one.kind] < rank[two.kind] ? -1 : 1
    let order = 0
    if (one.kind === 'step') order = compareInteger(one.index, two.index)
    else if (one.kind === 'text') order = compareInteger(one.value, two.value)
    else if (one.kind === 'media') {
      if ((one.time === null) !== (two.time === null)) return one.time === null ? -1 : 1
      if (one.time !== null) order = compareNumber(one.time, two.time)
      if (!order && Boolean(one.space) !== Boolean(two.space)) return one.space ? 1 : -1
      if (!order && one.space)
        order = compareNumber(one.space.y, two.space.y) || compareNumber(one.space.x, two.space.x)
    }
    if (order) return order
  }
  return left.length === right.length ? 0 : left.length < right.length ? -1 : 1
}
export function compareRanges(a, b) {
  const left = expandRange(a),
    right = expandRange(b)
  return comparePoints(left[0], right[0]) || comparePoints(left[1], right[1])
}
export function bias(cfi) {
  const tokens = point(cfi).tokens
  const entries = tokens.flatMap((token, index) =>
    (token.assertion?.params ?? [])
      .filter((item) => item.name === 's')
      .map((item) => ({ index, ...item }))
  )
  if (!entries.length) return null
  if (
    entries.length !== 1 ||
    entries[0].index !== tokens.length - 1 ||
    entries[0].values.length !== 1 ||
    !['a', 'b'].includes(entries[0].values[0]) ||
    tokens.at(-1).space
  )
    fail('invalidBias')
  return entries[0].values[0]
}
