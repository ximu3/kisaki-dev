// Exercise normal XML, explicit entity failures, encoding identity, and bounded parser cleanup.
import { createXmlParser, sourceText, withoutAttributes } from './xml-parser.mjs'

const bytes = (text) => new TextEncoder().encode(text)
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
export async function runXmlCases(factory, fixtures, readFixture, encodingMaps) {
  const parser = await createXmlParser(factory, encodingMaps)
  const normal = []
  for (const fixture of fixtures.filter((item) => item.format === 'fb2')) {
    const source = await readFixture(fixture.name)
    for (const chunk of [1, 2, 7, 64]) {
      const result = parser.parse(source, chunk)
      assert(
        result.ok &&
          JSON.stringify(withoutAttributes(result.tree)) === JSON.stringify(fixture.expectedTree),
        `XML source tree changed: ${fixture.name}`
      )
      normal.push({ name: fixture.name, chunk, matchedIndependentTree: true })
    }
  }
  const definitions = [
    { name: 'ordinary-doctype', source: '<!DOCTYPE p><p>A&amp;B</p>', text: 'A&B' },
    {
      name: 'ignored-external-subset',
      source: '<!DOCTYPE p SYSTEM "https://kana-invalid.example/external.dtd"><p>A&amp;B</p>',
      text: 'A&B',
      skipped: 1
    },
    {
      name: 'external-subset-unknown-entity',
      source:
        '<!DOCTYPE p SYSTEM "https://kana-invalid.example/external.dtd"><p>left&missing;right</p>',
      fail: true
    },
    {
      name: 'external-general-entity',
      source: '<!DOCTYPE p [<!ENTITY ext SYSTEM "file:///private.txt">]><p>left&ext;right</p>',
      fail: true,
      reason: 2
    },
    {
      name: 'external-parameter-entity',
      source:
        '<!DOCTYPE p [<!ENTITY % ext SYSTEM "https://kana-invalid.example/e">%ext;]><p>left&missing;right</p>',
      fail: true,
      reason: 2
    },
    {
      name: 'external-declaration-unused',
      source: '<!DOCTYPE p [<!ENTITY ext SYSTEM "https://kana-invalid.example/e">]><p>safe</p>',
      fail: true,
      reason: 2
    },
    {
      name: 'internal-parameter-entity',
      source:
        '<!DOCTYPE p [<!ENTITY % declaration "<!ENTITY word \'内部😀\'>">%declaration;]><p>&word;</p>',
      text: '内部😀'
    },
    {
      name: 'entity-in-attribute',
      source: '<!DOCTYPE p [<!ENTITY word "A&amp;B">]><p label="&word;">ok</p>',
      text: 'ok',
      attribute: ['label', 'A&B']
    },
    { name: 'undefined-entity', source: '<p>&missing;</p>', fail: true },
    {
      name: 'recursive-entity',
      source: '<!DOCTYPE p [<!ENTITY a "&b;"><!ENTITY b "&a;">]><p>&a;</p>',
      fail: true
    },
    {
      name: 'invalid-utf8',
      input: Uint8Array.from([60, 112, 62, 0xc0, 0xaf, 60, 47, 112, 62]),
      fail: true
    },
    { name: 'illegal-reference', source: '<p>&#0;</p>', fail: true },
    { name: 'unclosed-element', source: '<p><b>A</p>', fail: true },
    { name: 'undeclared-prefix', source: '<p><x:b/></p>', fail: true },
    {
      name: 'duplicate-expanded-attribute',
      source: '<p xmlns:a="urn:a" xmlns:b="urn:a" a:x="1" b:x="2"/>',
      fail: true
    },
    {
      name: 'depth-budget',
      source: '<p>'.repeat(20) + 'A' + '</p>'.repeat(20),
      fail: true,
      reason: 1,
      limits: { depth: 12 }
    },
    {
      name: 'node-budget',
      source: '<p>' + '<a/>'.repeat(20) + '</p>',
      fail: true,
      reason: 1,
      limits: { nodes: 12 }
    },
    {
      name: 'text-budget',
      source: '<p>' + 'A'.repeat(100) + '</p>',
      fail: true,
      reason: 1,
      limits: { output: 32 }
    },
    {
      name: 'unknown-encoding',
      source: '<?xml version="1.0" encoding="x-unknown"?><p>A</p>',
      fail: true
    }
  ]
  const latin = bytes('<?xml version="1.0" encoding="ISO-8859-1"?><p>')
  definitions.push({
    name: 'xml-latin1-is-not-windows1252',
    input: new Uint8Array([...latin, 0x80, ...bytes('</p>')]),
    text: '\u0080'
  })
  const cyrillic = bytes('<?xml version="1.0" encoding="windows-1251"?><p>')
  definitions.push({
    name: 'declared-windows1251',
    input: new Uint8Array([...cyrillic, 0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2, ...bytes('</p>')]),
    text: 'Привет'
  })
  const western = bytes('<?xml version="1.0" encoding="windows-1252"?><p>')
  definitions.push({
    name: 'declared-windows1252',
    input: new Uint8Array([...western, 0x80, 0x82, ...bytes('</p>')]),
    text: '€‚'
  })
  definitions.push({
    name: 'utf8-bom-declaration-conflict',
    input: new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...bytes('<?xml version="1.0" encoding="UTF-16"?><p>A</p>')
    ]),
    fail: true
  })
  const contradictory = '<?xml version="1.0" encoding="UTF-8"?><p>A</p>'
  definitions.push({
    name: 'utf16-bom-declaration-conflict',
    input: new Uint8Array([
      0xff,
      0xfe,
      ...[...contradictory].flatMap((character) => [character.charCodeAt(0), 0])
    ]),
    fail: true
  })
  const entities = Array.from(
    { length: 7 },
    (_, index) => `<!ENTITY e${index} "${index ? `&e${index - 1};`.repeat(10) : '1234567890'}">`
  ).join('')
  definitions.push({
    name: 'entity-amplification-budget',
    source: `<!DOCTYPE p [${entities}]><p>&e6;</p>`,
    fail: true,
    limits: { output: 64 * 1024 * 1024, amplificationThreshold: 1024 }
  })
  const cases = []
  for (const item of definitions) {
    for (const chunk of [1, 17]) {
      const result = parser.parse(item.input ?? bytes(item.source), chunk, item.limits)
      if (item.fail) {
        assert(
          !result.ok && result.publishedTree === false,
          `Invalid XML produced a source tree: ${item.name}`
        )
        if (item.reason)
          assert(result.failure === item.reason, `XML failure classification differs: ${item.name}`)
      } else {
        assert(
          result.ok && sourceText(result.tree) === item.text,
          `XML content differs: ${item.name}`
        )
        if (item.attribute)
          assert(
            result.tree.attributes.some(
              (pair) => JSON.stringify(pair) === JSON.stringify(item.attribute)
            ),
            'Attribute entity expansion differs'
          )
        if (item.skipped)
          assert(
            result.skippedSubsets === item.skipped,
            'External subset was not explicitly skipped'
          )
      }
      cases.push({
        name: item.name,
        chunk,
        ok: result.ok,
        failure: result.failure ?? null,
        nativeError: result.nativeError ?? null,
        skippedSubsets: result.skippedSubsets ?? null
      })
      assert(parser.parse(bytes('<p>fresh</p>')).ok, 'Parser failed to recover in a fresh instance')
    }
  }
  return {
    normal,
    cases,
    memoryBytes: parser.memoryBytes,
    allAssertionsPassed: true,
    candidateOnly: true
  }
}
