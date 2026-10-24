// Check the semantics that affect persisted CFI identity, independently of display node numbering.
import { createCfiBook, parseCfi, expandRange, escapeCfi, CfiFailure } from './cfi.mjs'
import { createXmlParser } from './xml-parser.mjs'
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

export async function runCfiCases(factory, sources) {
  const parser = await createXmlParser(factory)
  const records = []
  const documents = new Map()
  for (const [name, bytes] of sources) {
    const result = parser.parse(bytes, 1)
    assert(result.ok, 'EPUB XML source did not parse')
    documents.set(name, result.tree)
  }
  const book = createCfiBook('EPUB/package.opf', documents)
  const base = '/6/2[r1]!/4/2[' + escapeCfi('p,[x];=^') + ']'
  const point = (suffix) => `epubcfi(${base}${suffix})`
  function check(name, action) {
    action()
    records.push({ name, passed: true })
  }
  function reject(name, value, reason, operation = book.resolve) {
    check(name, () => {
      let caught = false
      try {
        operation(value)
      } catch (error) {
        caught = error instanceof CfiFailure && (!reason || reason === error.reason)
      }
      assert(caught, 'Invalid CFI was not rejected: ' + name)
    })
  }
  check('comments-cdata-pi-share-one-source-text-slot', () =>
    assert(book.resolve(point('/1:4')).node.text === '甲乙😀丙', 'Source CFI text chunk differs')
  )
  check('escaped-assertion-identifies-original-element', () =>
    assert(book.resolve(point('/1:4')).textOffset === 4, 'Escaped assertion changed the offset')
  )
  check('duplicate-spine-occurrences-remain-distinct', () => {
    const first = book.resolve(point('/1:4')),
      second = book.resolve(point('/1:4').replace('/2[r1]', '/4[r2]'))
    assert(
      first.documentName === second.documentName &&
        first.occurrence === 0 &&
        second.occurrence === 1,
      'Repeated href lost occurrence identity'
    )
  })
  check('text-assertion-crosses-element-boundary', () =>
    assert(book.resolve(point('/1:5[丙,中後]')).textOffset === 5, 'Cross-node assertion failed')
  )
  check('side-bias-is-preserved', () =>
    assert(
      book.resolve(point('/1:5[;s=b]')).bias === 'b' &&
        book.resolve(point('/1:5[;s=a]')).bias === 'a',
      'Side bias was dropped'
    )
  )
  for (const slot of [1, 3, 5])
    check(`empty-text-slot-${slot}`, () =>
      assert(
        book.resolve(`epubcfi(/6/2[r1]!/4/4[gaps]/${slot}:0)`).node.virtual,
        'Empty CFI slot disappeared'
      )
    )
  for (const step of [0, 6])
    check(`virtual-element-${step}`, () =>
      assert(
        book.resolve(`epubcfi(/6/2[r1]!/4/4[gaps]/${step})`).node.kind === 'boundary',
        'Virtual boundary disappeared'
      )
    )
  check('range-expands-into-two-complete-points', () => {
    const [start, end] = expandRange(`epubcfi(${base},/1:1,/3:1)`)
    assert(
      book.resolve(start).node.text.slice(1) === '乙😀丙' && book.resolve(end).node.text === '後',
      'Expanded range changed its source ends'
    )
  })
  check('nested-object-indirection-honors-source-fragment', () => {
    const result = book.resolve('epubcfi(/6/2[r1]!/4/6!/2/1:1)')
    assert(
      result.documentName === 'EPUB/diagram.svg' &&
        result.node.text === '図' &&
        result.occurrence === 0,
      'Nested indirection changed its source context'
    )
  })
  check('spatial-terminal-is-preserved', () =>
    assert(
      JSON.stringify(book.resolve('epubcfi(/6/2[r1]!/4/6@20:30)').space) === '[20,30]',
      'Spatial terminal was dropped'
    )
  )
  check('temporal-and-spatial-syntax-is-preserved', () => {
    const offset = parseCfi('epubcfi(/6/2!/4/6~12.5@20:30)').segments.at(-1).offset
    assert(offset.time === 12.5 && offset.space[1] === 30, 'Temporal syntax was discarded')
  })
  check('percent-is-not-cfi-unescaping', () =>
    assert(
      book.resolve('epubcfi(/6/2[r1]!/4/8[percent%20literal]/1:1)').node.text === '終',
      'Percent text was URL-decoded twice'
    )
  )
  reject('assertion-mismatch-does-not-search', point('/1:5[wrong]'), 'assertionMismatch')
  reject('id-mismatch-does-not-rebind', point('/1:4').replace('r1', 'r3'), 'assertionMismatch')
  reject('half-surrogate', point('/1:3'), 'invalidOffset')
  reject('offset-outside-text', point('/1:100'), 'invalidOffset')
  reject('missing-source-node', point('/9:0'), 'missingNode')
  reject('nonterminal-side-bias', `epubcfi(${base.slice(0, -1)};s=a]/1:0)`, 'invalidBias')
  reject('side-bias-with-spatial-offset', 'epubcfi(/6/2[r1]!/4/6@20:30[;s=b])', 'invalidOffset')
  reject('spatial-outside-page', 'epubcfi(/6/2[r1]!/4/6@101:30)', 'invalidOffset')
  reject(
    'range-cannot-carry-side-bias',
    `epubcfi(${base},/1:1[;s=a],/3:1)`,
    'rangeBias',
    expandRange
  )
  for (const value of [
    'epubcfi(/06/2)',
    'epubcfi(/6/2!:01)',
    'epubcfi(/6/2!/4~1.0)',
    'epubcfi(/6/2[bad^x])',
    'epubcfi(/6/2[])',
    'epubcfi(/6/2[a=b])',
    'epubcfi(/6/2!/4:1[\ud800])'
  ])
    reject('invalid-syntax-' + records.length, value, 'syntax', parseCfi)
  const reopened = new Map()
  for (const [name, bytes] of sources) reopened.set(name, parser.parse(bytes, 17).tree)
  const fresh = createCfiBook('EPUB/package.opf', reopened)
  check('serialized-point-restores-after-fresh-parse', () => {
    const value = JSON.parse(JSON.stringify({ type: 'epubCfi', value: point('/1:4[;s=b]') })).value
    const result = fresh.resolve(value)
    assert(
      result.occurrence === 0 &&
        result.textOffset === 4 &&
        result.bias === 'b' &&
        result.node.text === '甲乙😀丙',
      'Fresh XML parse changed a CFI'
    )
  })
  return {
    cases: records,
    allAssertionsPassed: true,
    completeCfiConformanceProved: false,
    mediaPlaybackExecuted: false
  }
}
