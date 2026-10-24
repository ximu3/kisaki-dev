// Fixed expectations cover reading order and a total ordering over distinct source identities.
import { createOrder } from './order.mjs'
const assert = (condition) => {
  if (!condition) throw new Error('Image member ordering expectation failed.')
}
const cases = [
  {
    name: 'integer-pages',
    input: ['10.jpg', '2.jpg', '1.jpg'],
    expected: ['1.jpg', '2.jpg', '10.jpg']
  },
  {
    name: 'case-fold-before-number',
    input: ['Page10.jpg', 'page2.jpg'],
    expected: ['page2.jpg', 'Page10.jpg']
  },
  {
    name: 'leading-zero-ties',
    input: ['001.jpg', '10.jpg', '01.jpg', '1.jpg'],
    expected: ['1.jpg', '01.jpg', '001.jpg', '10.jpg']
  },
  {
    name: 'component-grouping',
    input: ['vol01/1.jpg', 'vol1/10.jpg', 'vol1/2.jpg', 'vol2/1.jpg'],
    expected: ['vol1/2.jpg', 'vol1/10.jpg', 'vol01/1.jpg', 'vol2/1.jpg']
  },
  {
    name: 'case-distinct-folders',
    input: ['vol1/1.jpg', 'Vol1/10.jpg', 'Vol1/2.jpg'],
    expected: ['Vol1/2.jpg', 'Vol1/10.jpg', 'vol1/1.jpg']
  },
  {
    name: 'fullwidth-and-arabic-digits',
    input: ['page１０.jpg', 'page٢.jpg', 'page2.jpg', 'page２.jpg'],
    expected: ['page2.jpg', 'page٢.jpg', 'page２.jpg', 'page１０.jpg']
  },
  {
    name: 'large-integers',
    input: ['9007199254740993.jpg', '9007199254740992.jpg'],
    expected: ['9007199254740992.jpg', '9007199254740993.jpg']
  },
  {
    name: 'no-canonical-name-merge',
    input: ['é1.jpg', 'e\u03011.jpg'],
    expected: ['e\u03011.jpg', 'é1.jpg']
  },
  { name: 'fold-expansion-tie', input: ['ss1.jpg', 'ß1.jpg'], expected: ['ss1.jpg', 'ß1.jpg'] },
  {
    name: 'unicode-scalars',
    input: ['𐀀1.jpg', '\ue0001.jpg'],
    expected: ['\ue0001.jpg', '𐀀1.jpg']
  },
  {
    name: 'digit-versus-letter-cycle',
    input: ['٢.jpg', 'A.jpg', '10.jpg'],
    expected: ['٢.jpg', '10.jpg', 'A.jpg']
  },
  {
    name: 'literal-punctuation',
    input: ['p2.jpg', 'p-2.jpg', 'p.2.jpg', 'p_2.jpg'],
    expected: ['p-2.jpg', 'p.2.jpg', 'p2.jpg', 'p_2.jpg']
  }
]

export function checkOrder(data) {
  const compare = createOrder(data)
  const observations = cases.map((item) => {
    const result = [...item.input].sort(compare)
    assert(JSON.stringify(result) === JSON.stringify(item.expected))
    return { name: item.name, order: result }
  })
  const members = [
    ...new Set([
      ...cases.flatMap((item) => item.input),
      ...['A', 'a', 'ß', 'ss', 'é', 'e\u0301', '٢', '2', '２', '\ue000', '𐀀'].flatMap((prefix) =>
        ['0', '00', '01', '1', '2', '10', '9007199254740993'].map(
          (suffix) => prefix + suffix + '.jpg'
        )
      )
    ])
  ]
  const sorted = [...members].sort(compare)
  let pairChecks = 0
  for (let left = 0; left < sorted.length; left++) {
    assert(compare(sorted[left], sorted[left]) === 0)
    for (let right = left + 1; right < sorted.length; right++) {
      assert(compare(sorted[left], sorted[right]) < 0 && compare(sorted[right], sorted[left]) > 0)
      pairChecks++
    }
  }
  let random = 0x35219
  for (let pass = 0; pass < 64; pass++) {
    const shuffled = [...members]
    for (let index = shuffled.length - 1; index > 0; index--) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0
      const other = random % (index + 1)
      ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
    }
    assert(JSON.stringify(shuffled.sort(compare)) === JSON.stringify(sorted))
  }
  for (const [code, value] of Object.entries(data.digits)) {
    const digit = String.fromCodePoint(Number(code))
    assert(compare('p' + digit + '.jpg', 'p10.jpg') < 0)
    if (value > 0) assert(compare('p' + (value - 1) + '.jpg', 'p' + digit + '.jpg') < 0)
  }
  return {
    allAssertionsPassed: true,
    observations,
    distinctPaths: members.length,
    pairChecks,
    shuffledListings: 64,
    decimalDigitsChecked: Object.keys(data.digits).length,
    localeApiUsed: false,
    sourceNamesRewritten: false,
    realArchiveExtractionExecuted: false
  }
}
