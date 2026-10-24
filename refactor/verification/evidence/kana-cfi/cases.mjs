// Owned XML fixtures separate syntax, source identity, and display capabilities.
import {
  parseCfi,
  serializeCfi,
  comparePoints,
  compareRanges,
  expandRange,
  escapeCfi,
  bias,
  CfiFailure,
  fail
} from './grammar.mjs'
import { createSourceParser } from './source.mjs'
import { createCfiBook, NS, attr } from './book.mjs'

export const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
export function rejects(run, expected) {
  try {
    run()
  } catch (error) {
    assert(
      error instanceof CfiFailure && error.reason === expected,
      'Unexpected CFI failure: ' + error.reason + ', expected ' + expected
    )
    return
  }
  throw new Error('The invalid CFI was accepted: ' + expected)
}
export const fixtures = new Map([
  [
    'pkg.opf',
    `<package xmlns="${NS.opf}" version="3.0"><metadata><title xmlns="urn:fixture">Source title</title></metadata><manifest><item id="one" href="text/one.xhtml"/><item id="two" href="text/two.xhtml"/><item id="picture" href="picture.bin"/></manifest><bindings/><spine id="spine"><itemref id="first" idref="one"/><itemref id="repeat" idref="one"/><itemref id="note" idref="two" linear="no"/><itemref id="last" idref="two"/><itemref id="plate" idref="picture"/></spine></package>`
  ],
  [
    'text/one.xhtml',
    `<html xmlns="${NS.html}" xmlns:xlink="${NS.xlink}"><head><title>Head</title></head><body id="body">lead<p xml:id="para">甲&#x1F600;乙<![CDATA[&]]><!--ignored--><?probe ignored?>é<b id="bold">内</b> \n tail</p><p id="adjacent"><i>A</i><b>B</b></p><img id="art" alt="図😀&amp;版" src="../picture.bin"/><iframe id="frame" src="nested.xhtml#embed-root"/><object id="video-object" data="../video.bin"/><embed id="embed" src="nested.xhtml#embed-root"/><a id="link" href="nested.xhtml#embed-root">anchor</a><video id="video"/><audio id="audio"/><svg xmlns="${NS.svg}" id="drawing"><use id="use" xlink:href="../shape.svg#group"/><image id="image" xlink:href="../picture.bin"/></svg><object id="xml-object" data="nested.xhtml"/><object id="audio-object" data="../audio.bin"/><embed id="declared" src="../declared.xml"/><iframe id="ambiguous" src="two.xhtml#duplicate"/><iframe id="missing" src="missing.xhtml"/></body></html>`
  ],
  [
    'text/two.xhtml',
    `<html xmlns="${NS.html}"><head/><body id="second"><p id="two">第二章</p><p id="duplicate">甲</p><p id="duplicate">乙</p></body></html>`
  ],
  [
    'text/nested.xhtml',
    `<html xmlns="${NS.html}"><head/><body><section id="embed-root"><p id="deep">入れ子𠮷</p><object id="nested-image" data="../picture.bin"/></section><p>Outside fragment</p></body></html>`
  ],
  [
    'shape.svg',
    `<svg xmlns="${NS.svg}" xmlns:xlink="${NS.xlink}"><g xml:id="group"><text id="svg-text">図中</text><use id="nested-use" xlink:href="#leaf"/></g><g id="leaf"><text>葉</text></g></svg>`
  ],
  [
    'declared.xml',
    '<!DOCTYPE root [<!ATTLIST node code ID #REQUIRED>]><root xmlns="urn:fixture"><node code="declared-id">DTD ID</node></root>'
  ]
])
export const byId = (context, id) => {
  const matches = context.document.byId.get(id)
  assert(matches?.length === 1, 'The fixture ID is not unique: ' + id)
  return matches[0]
}
export const firstText = (node) => {
  if (node.kind === 'text') return node
  for (const child of node.children ?? []) {
    const found = firstText(child)
    if (found) return found
  }
}
export function finiteReference(source, _node, href) {
  const url = new URL(href, 'https://fixture.invalid/' + source)
  if (url.origin !== 'https://fixture.invalid') fail('missingDocument')
  return {
    name: decodeURIComponent(url.pathname.slice(1)),
    fragment: url.hash ? decodeURIComponent(url.hash.slice(1)) : ''
  }
}
export async function setup(factory, catalog, chunk = 4096) {
  const parser = await createSourceParser(factory, catalog)
  const resources = new Map(
    [...fixtures].map(([name, source]) => [
      name,
      { tree: parser.parse(new TextEncoder().encode(source), chunk) }
    ])
  )
  for (const media of ['image', 'audio', 'video'])
    resources.set(media === 'image' ? 'picture.bin' : media + '.bin', { kind: 'resource', media })
  return createCfiBook('pkg.opf', resources, finiteReference)
}
const raw = (body) => `epubcfi(${body})`
export function grammarCases() {
  const cases = []
  const check = (name, run) => {
    run()
    cases.push(name)
  }
  const valid = [
    '/8/2!/4/2/1:0',
    '/0',
    '/999999999999999999999999999999999',
    '/8/2!/4/2/1',
    '/8/2!/4/2/1:9007199254740993',
    '/8/2!@0:100',
    '/8/2!~0',
    '/8/2!~0.00000000000000000000001@10.01:20.99',
    '/8/2!/4/2[;s=b]',
    '/8/2!/4/2/1:2[,after]',
    '/8/2!/4/2/1:2[before,after;s=a;vnd.test=x,y]',
    '/8/2!/4/2/1:2[before^,after^;^=^^^[^]^(^)]',
    '/8/2[Ф-99%-aa^[bb^]^^]!/4/2/1:0',
    '/8/2[ID;\t=x y]',
    '/8/2!/4/2,/1:0,/1:3',
    '/8/2!/4/2,,/2/1:0',
    '/8/2,!/4/2/1:0,!/4/2/1:3',
    '/8/2,,'
  ]
  for (const value of valid)
    check('roundtrip:' + value, () =>
      assert(serializeCfi(parseCfi(raw(value))) === raw(value), 'CFI serialization changed tokens.')
    )
  const invalid = [
    '',
    '/01',
    '/+1',
    '/-1',
    '/1.1',
    ':0',
    '/8!',
    '/8!!/4',
    '/8!~',
    '/8~01',
    '/8~0.0',
    '/8~1.10',
    '/8~1e3',
    '/8~.1',
    '/8~1.',
    '/8@0',
    '/8@0:100~1',
    '/8:1/2',
    '/8[a,]',
    '/8[,]',
    '/8[]',
    '/8[a,b,c]',
    '/8[a=b]',
    '/8[a(b)]',
    '/8[a[b]]',
    '/8[a^x]',
    '/8[a^]',
    '/8[;=a]',
    '/8[;a=]',
    '/8[;a=x,]',
    '/8[;a b=x]',
    '/8:0,:0,:1',
    '/8,/2',
    '/8,/2,/4,/6',
    '/8\u0000',
    '/8[\ud800]',
    '/8[\uffff]'
  ]
  for (const value of invalid)
    check('syntax:' + value, () => rejects(() => parseCfi(raw(value)), 'syntax'))
  check('escape-every-delimiter', () => {
    const value = '^[](),;=😀'
    assert(
      parseCfi(raw('/8[' + escapeCfi(value) + ']')).tokens[0].assertion.values[0] === value,
      'Escaped assertion changed.'
    )
  })
  const ordered = [
    '/8/2',
    '/8/2:0',
    '/8/2/0',
    '/8/2/1',
    '/8/2/2',
    '/8/2@0:0',
    '/8/2@99:1',
    '/8/2@0:2',
    '/8/2~0',
    '/8/2~0@0:0',
    '/8/2~0.00000000000000000000001',
    '/8/2~9007199254740992',
    '/8/2~9007199254740993',
    '/8/2!/0',
    '/8/10',
    '/8/9007199254740992',
    '/8/9007199254740993'
  ]
  check('total-source-sort', () => {
    for (let left = 0; left < ordered.length; left++)
      for (let right = 0; right < ordered.length; right++)
        assert(
          comparePoints(raw(ordered[left]), raw(ordered[right])) === Math.sign(left - right),
          'CFI natural ordering changed.'
        )
  })
  check('implicit-zero-and-assertions', () => {
    assert(
      comparePoints(raw('/8/2[one]!/4/1'), raw('/8/2[other]!/4/1:0[;s=a]')) === 0,
      'Implicit zero or assertions changed comparison.'
    )
  })
  check('range-expansion-and-sort', () => {
    assert(
      expandRange(raw('/8/2!/4,/1:0,/1:3'))[1] === raw('/8/2!/4/1:3'),
      'Range end was truncated.'
    )
    assert(
      compareRanges(raw('/8/2!/4,/1:0,/1:3'), raw('/8/2!/4,/1:0,/1:4')) < 0,
      'Range end was ignored.'
    )
  })
  for (const value of [
    '/8[;s=b]/2',
    '/8/2[;s=c]',
    '/8/2[;s=a,b]',
    '/8/2[;s=a;s=b]',
    '/8/2@0:0[;s=a]'
  ])
    check('invalid-bias:' + value, () => rejects(() => bias(raw(value)), 'invalidBias'))
  check('range-bias', () => rejects(() => expandRange(raw('/8/2,/1:0[;s=a],/1:2')), 'rangeBias'))
  check('raw-percent-is-not-url-decoded', () =>
    assert(
      parseCfi(raw('/8[99%25]')).tokens[0].assertion.values[0] === '99%25',
      'URL layer leaked.'
    )
  )
  return cases
}
export function sourceCases(book) {
  const cases = []
  const check = (name, run) => {
    run()
    cases.push(name)
  }
  const context = book.contextForOccurrence(0)
  const prefix = '/8[spine]/2[first]!'
  const para = prefix + '/4[body]/2[para]'
  const targetFor = (id, suffix = '') => {
    const node = byId(context, id)
    const base = book.generate({ context, node })
    return base.slice(0, -1) + suffix + ')'
  }
  check('actual-package-spine-index', () =>
    assert(book.resolve(raw(para + '/1:1')).node.text === '甲😀乙&é', 'Source text changed.')
  )
  check('generator-includes-all-ids', () =>
    assert(
      book.generate(book.resolve(raw('/8/2!/4/2/1:1'))) === raw(para + '/1:1'),
      'Generated CFI omitted a known XML ID.'
    )
  )
  check('repeated-spine-keeps-occurrence', () => {
    const one = book.resolve(raw('/8/2!/4/2/1:1'))
    const two = book.resolve(raw('/8/4!/4/2/1:1'))
    assert(
      one.node === two.node && one.context.occurrence === 0 && two.context.occurrence === 1,
      'Repeated spine context was lost.'
    )
    assert(book.generate(one) !== book.generate(two), 'Repeated resource became one address.')
  })
  check('xml-id-and-source-expansion', () => {
    assert(attr(byId(context, 'para'), 'id', NS.xml) === 'para', 'xml:id was lost.')
    assert(book.resolve(raw(para + '/1')).offset === 0, 'Implicit character offset changed.')
  })
  check('side-bias-roundtrip', () => {
    const value = raw(para + '/1:3[;s=b]')
    const target = book.resolve(value)
    assert(
      target.bias === 'b' && book.generate(target) === value,
      'Side bias changed during generation.'
    )
  })
  check('url-layer-decodes-once', () => {
    const reference = finiteReference('pkg.opf', null, 'text/nested.xhtml#%65mbed-root')
    assert(reference.fragment === 'embed-root', 'URL fragment was not decoded.')
    const literal = finiteReference('pkg.opf', null, 'text/nested.xhtml#%2565mbed-root')
    assert(literal.fragment === '%65mbed-root', 'URL fragment was decoded twice.')
  })
  check('text-assertion-crosses-elements', () => book.resolve(raw(para + '/3:3[é内 ,tail]')))
  check('empty-text-slot-assertion', () => {
    const value = targetFor('adjacent', '/3:0[A,B]')
    assert(book.resolve(value).node.virtual, 'The empty logical text slot disappeared.')
  })
  check('virtual-first-last-element', () => {
    assert(book.resolve(raw(para + '/0')).node.edge === 'start', 'First boundary changed.')
    assert(book.resolve(raw(para + '/4')).node.edge === 'end', 'Last boundary changed.')
  })
  check('utf16-and-scalar-boundaries', () => {
    assert(book.resolve(raw(para + '/1:3')).offset === 3, 'UTF-16 width changed.')
    rejects(() => book.resolve(raw(para + '/1:2')), 'outOfBounds')
  })
  check('alt-offset-is-source-content', () => {
    const target = book.resolve(targetFor('art', ':3[図😀,&版]'))
    assert(target.kind === 'alt' && target.offset === 3, 'alt text offset was lost.')
    assert(book.resolve(book.generate(target)).offset === 3, 'alt generation changed.')
  })
  check('strict-id-and-text-assertions', () => {
    rejects(() => book.resolve(raw(para.replace('[para]', '[bold]') + '/1:0')), 'assertionMismatch')
    rejects(() => book.resolve(raw(para + '/1:1[wrong]')), 'assertionMismatch')
  })
  check('invalid-source-steps', () => {
    rejects(() => book.resolve(raw('/6/2!/4')), 'invalidPackagePath')
    rejects(() => book.resolve(raw(para + '/999999999999999999999')), 'outOfBounds')
    rejects(() => book.resolve(raw(para + '/1:999999999999999999999')), 'outOfBounds')
    rejects(() => book.resolve(raw(para + ':0')), 'invalidOffset')
    rejects(() => book.resolve(raw(para + '/1[id]:0')), 'invalidAssertion')
  })
  for (const id of ['frame', 'embed'])
    check('embedded-fragment:' + id, () => {
      const target = book.resolve(targetFor(id, '!/2[deep]/1:3'))
      assert(
        target.node.text === '入れ子𠮷' && target.context.occurrence === 0,
        'Embedding context changed.'
      )
      assert(
        book.generate(target).includes('!') && book.resolve(book.generate(target)).offset === 3,
        'Nested CFI generation changed.'
      )
    })
  check('nested-svg-reference', () => {
    const contextSvg = book.contextForEmbedding(context, byId(context, 'use'))
    const leaf = book.contextForEmbedding(contextSvg, byId(contextSvg, 'nested-use'))
    const target = { context: leaf, node: firstText(leaf.root), kind: 'text', offset: 1 }
    const saved = book.generate(target)
    assert(
      (saved.match(/!/g) ?? []).length === 3 && book.resolve(saved).node.text === '葉',
      'Nested SVG indirection changed.'
    )
  })
  check('dtd-declared-id', () => {
    const declared = book.contextForEmbedding(context, byId(context, 'declared'))
    const node = byId(declared, 'declared-id')
    assert(
      node.declaredId === 'declared-id' &&
        book.generate({ context: declared, node }).includes('[declared-id]'),
      'The parser-declared XML ID was lost.'
    )
  })
  check('only-permitted-indirections', () => {
    rejects(() => book.resolve(targetFor('link', '!/2/1:0')), 'invalidIndirection')
    rejects(() => book.resolve(targetFor('ambiguous', '!/1:0')), 'ambiguous')
    rejects(() => book.resolve(targetFor('missing', '!/1:0')), 'missingDocument')
  })
  check('exact-temporal-spatial-values', () => {
    const value = targetFor('video-object', '!~0@12.000000000000000000001:99.9')
    const target = book.resolve(value)
    assert(
      target.time === '0' && target.space.x === '12.000000000000000000001',
      'A source media coordinate was rounded or omitted.'
    )
    assert(book.generate(target) === value, 'Media source generation changed.')
    book.resolve(targetFor('art', '@0:100'))
    book.resolve(targetFor('video', '~9007199254740993'))
    book.resolve(targetFor('audio-object', '~0'))
    rejects(() => book.resolve(targetFor('xml-object', '~0')), 'invalidOffset')
    rejects(() => book.resolve(targetFor('frame', '@0:0')), 'invalidOffset')
    rejects(() => book.resolve(targetFor('audio', '@0:0')), 'invalidOffset')
    rejects(() => book.resolve(targetFor('art', '@100.01:0')), 'outOfBounds')
  })
  check('binary-spine-resource', () => {
    const target = book.resolve(raw('/8/10!@12:75'))
    assert(
      target.context.occurrence === 4 && target.node.media === 'image',
      'Binary spine target changed.'
    )
    assert(
      book.generate(target) === raw('/8[spine]/10[plate]!@12:75'),
      'Binary source generation changed.'
    )
  })
  check('range-full-endpoints-and-path', () => {
    const range = book.resolveRange(raw('/8,/2!/4/2/1:1,/4!/4/2/1:3'), true)
    assert(
      range.start.context.occurrence === 0 && range.end.context.occurrence === 1,
      'Cross-occurrence range lost its full endpoint.'
    )
    rejects(() => book.resolveRange(raw('/8,/2!/4/2/1:0,/6!/4/2/1:1'), true), 'notRenderable')
    rejects(() => book.resolveRange(raw('/8/2!/4/2/1,:3,:1')), 'invalidRange')
    rejects(() => book.resolveRange(raw('/8/2!/4/2/1,:1,:1'), true), 'invalidRange')
    book.resolveRange(raw('/8/2!/4/2/1,:1,:1'))
  })
  check('link-range-uses-start', () => {
    const target = book.resolveLink(raw('/8/2!/4/2/1,:1,:3'))
    assert(target.offset === 1, 'A range link did not resolve its start.')
  })
  check('intra-publication-package-path', () => {
    assert(
      book.resolveLink(raw('/2/2/1:1'), { mode: 'intra-publication' }).node.text === 'Source title',
      'An intra-publication package path was rejected.'
    )
    rejects(() => book.resolve(raw('/2/2/1:1')), 'invalidPackagePath')
  })
  return cases
}
export function textTargets(book) {
  const contexts = [0, 1, 2, 3].map(book.contextForOccurrence)
  const first = contexts[0]
  for (const id of ['frame', 'embed', 'use', 'declared'])
    contexts.push(book.contextForEmbedding(first, byId(first, id)))
  const targets = []
  for (const context of contexts) {
    function visit(node) {
      if (node.kind === 'text') {
        let offset = 0
        targets.push({ context, node, kind: 'text', offset })
        for (const character of node.text) {
          offset += character.length
          targets.push({ context, node, kind: 'text', offset })
        }
      } else node.children?.forEach(visit)
    }
    visit(context.root)
  }
  return targets
}
export async function runCfiCases(factory, catalog) {
  const modules = []
  const trackedFactory = async (options) => {
    const module = await factory(options)
    modules.push(module)
    return module
  }
  const grammar = grammarCases()
  const book = await setup(trackedFactory, catalog)
  const source = sourceCases(book)
  const targets = textTargets(book)
  const saved = targets.map((target) => ({
    value: book.generate(target),
    text: target.node.text,
    offset: target.offset,
    occurrence: target.context.occurrence,
    document: target.context.document.name
  }))
  let restores = 0
  for (const chunk of [1, 3, 4096]) {
    const reopened = await setup(trackedFactory, catalog, chunk)
    for (const target of saved) {
      const actual = reopened.resolve(target.value)
      assert(
        actual.node.text === target.text &&
          actual.offset === target.offset &&
          actual.context.occurrence === target.occurrence &&
          actual.context.document.name === target.document &&
          reopened.generate(actual) === target.value,
        'CFI changed after reparsing.'
      )
      restores++
    }
  }
  const activeParsers = modules.reduce((sum, module) => sum + module._kana_entry_active(), 0)
  assert(activeParsers === 0, 'A source XML parser remained active.')
  return {
    grammar,
    source,
    savedTextEndpoints: saved.length,
    reopenedEndpoints: restores,
    chunks: [1, 3, 4096],
    fixtureDocuments: fixtures.size,
    activeParsers,
    fullReader: false
  }
}
