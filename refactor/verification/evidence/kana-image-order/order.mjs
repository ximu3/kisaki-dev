// Compare canonical member paths without depending on locale, enumeration order or numeric precision.
const compareSequence = (left, right, compare) => {
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const difference = compare(left[index], right[index])
    if (difference) return difference
  }
  return left.length - right.length
}
const compareScalar = (left, right) => left - right

export function createOrder({ digits, fold }) {
  const keys = new Map()
  const componentKey = (value) => {
    const original = Array.from(value, (character) => character.codePointAt(0))
    const folded = original.flatMap((code) => fold[code] ?? [code])
    const tokens = [],
      widths = []
    for (let index = 0; index < folded.length;) {
      const code = folded[index]
      if (digits[code] === undefined) {
        tokens.push({ code })
        index++
        continue
      }
      let run = ''
      while (index < folded.length && digits[folded[index]] !== undefined)
        run += digits[folded[index++]]
      widths.push(run.length)
      tokens.push({ code: 48, number: run.replace(/^0+/, '') || '0' })
    }
    return { tokens, widths, original }
  }
  const key = (value) => {
    if (!keys.has(value)) keys.set(value, value.split('/').map(componentKey))
    return keys.get(value)
  }
  const compareToken = (left, right) => {
    if (left.number !== undefined && right.number !== undefined)
      return (
        left.number.length - right.number.length ||
        (left.number < right.number ? -1 : left.number > right.number ? 1 : 0)
      )
    return left.code - right.code
  }
  const compareComponent = (left, right) =>
    compareSequence(left.tokens, right.tokens, compareToken) ||
    compareSequence(left.widths, right.widths, compareScalar) ||
    compareSequence(left.original, right.original, compareScalar)
  return (left, right) => compareSequence(key(left), key(right), compareComponent)
}
