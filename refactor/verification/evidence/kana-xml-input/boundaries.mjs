// Exercise byte decoding, source budgets and fresh-parser cleanup using controlled inputs.
import { sourceText } from './parser.mjs'

const bytes = (text) => new TextEncoder().encode(text)
const join = (...parts) => new Uint8Array(parts.flatMap((part) => Array.from(part)))
const utf16 = (text, littleEndian) => {
  const result = [littleEndian ? 0xff : 0xfe, littleEndian ? 0xfe : 0xff]
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i)
    result.push(...(littleEndian ? [value & 255, value >> 8] : [value >> 8, value & 255]))
  }
  return new Uint8Array(result)
}

export function boundaries(parser) {
  const encodings = [
    {
      name: 'utf8',
      data: bytes('<?xml version="1.0" encoding="UTF-8"?><p>文字😀</p>'),
      text: '文字😀'
    },
    {
      name: 'utf16le',
      data: utf16('<?xml version="1.0" encoding="UTF-16"?><p>文字😀</p>', true),
      text: '文字😀'
    },
    {
      name: 'utf16be',
      data: utf16('<?xml version="1.0" encoding="UTF-16"?><p>文字😀</p>', false),
      text: '文字😀'
    },
    {
      name: 'xml-latin1',
      data: join(bytes('<?xml version="1.0" encoding="ISO-8859-1"?><p>'), [0x80], bytes('</p>')),
      text: '\u0080'
    },
    {
      name: 'windows1251',
      data: join(
        bytes('<?xml version="1.0" encoding="windows-1251"?><p>'),
        [0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2],
        bytes('</p>')
      ),
      text: 'Привет'
    },
    {
      name: 'windows1252',
      data: join(
        bytes('<?xml version="1.0" encoding="windows-1252"?><p>'),
        [0x80, 0x82],
        bytes('</p>')
      ),
      text: '€‚'
    },
    { name: 'invalid-utf8', data: join(bytes('<p>'), [0xc0, 0xaf], bytes('</p>')), reject: true },
    {
      name: 'utf8-bom-conflict',
      data: join([0xef, 0xbb, 0xbf], bytes('<?xml version="1.0" encoding="UTF-16"?><p>A</p>')),
      reject: true
    },
    {
      name: 'utf16-bom-conflict',
      data: utf16('<?xml version="1.0" encoding="UTF-8"?><p>A</p>', true),
      reject: true
    }
  ]
  const budgets = [
    {
      name: 'depth',
      data: bytes('<p>'.repeat(20) + 'A' + '</p>'.repeat(20)),
      limits: { depth: 8 }
    },
    { name: 'nodes', data: bytes('<p>' + '<b/>'.repeat(20) + '</p>'), limits: { nodes: 8 } },
    { name: 'text', data: bytes('<p>' + 'A'.repeat(1000) + '</p>'), limits: { text: 64 } },
    {
      name: 'attribute',
      data: bytes('<p a="' + 'A'.repeat(1000) + '"/>'),
      limits: { metadata: 64 }
    },
    {
      name: 'entity-declaration',
      data: bytes('<!DOCTYPE p [<!ENTITY e "' + 'A'.repeat(1000) + '">]><p/>'),
      limits: { metadata: 64 }
    },
    {
      name: 'entity-expansion',
      data: bytes(
        '<!DOCTYPE p [' +
          Array.from(
            { length: 7 },
            (_, i) => `<!ENTITY e${i} "${i ? `&e${i - 1};`.repeat(10) : '0123456789'}">`
          ).join('') +
          ']><p>&e6;</p>'
      ),
      limits: { text: 1024 }
    }
  ]
  const observations = []
  for (const item of [
    ...encodings,
    ...budgets.map((item) => ({ ...item, reject: true, budget: true }))
  ]) {
    for (const chunk of [1, 31]) {
      const result = parser.parse(item.data, chunk, item.limits)
      const matched = item.reject
        ? !result.ok && result.publishedTree === false
        : result.ok && sourceText(result.tree) === item.text
      if (!matched || (item.budget && result.failure !== 1))
        throw new Error(`XML boundary expectation failed: ${item.name}`)
      const fresh = parser.parse(bytes('<p>fresh</p>'), 3)
      if (!fresh.ok || sourceText(fresh.tree) !== 'fresh')
        throw new Error('A fresh XML parse inherited a prior failure.')
      observations.push({
        name: item.name,
        chunk,
        ok: result.ok,
        failure: result.failure,
        nativeError: result.nativeError,
        freshParserPassed: true
      })
    }
  }
  return { comparisons: observations.length, allAssertionsPassed: true, observations }
}

export async function checkFb2(parser, fixtures, readBytes) {
  const canonical = (node) =>
    typeof node === 'string'
      ? { kind: 'text', text: node }
      : {
          kind: 'element',
          name: node.name,
          namespace: node.namespace || null,
          children: node.children.map(canonical)
        }
  const results = []
  for (const fixture of fixtures.filter((item) => item.format === 'fb2')) {
    const data = await readBytes(fixture.name)
    for (const chunk of [1, 17, 4096]) {
      const parsed = parser.parse(data, chunk)
      if (
        !parsed.ok ||
        JSON.stringify(canonical(parsed.tree)) !== JSON.stringify(fixture.expectedTree)
      )
        throw new Error('The XML candidate differed from the independent FB2 source tree.')
      results.push({
        name: fixture.name,
        chunk,
        matchedIndependentTree: true,
        schemaValid: fixture.schemaValid
      })
    }
  }
  return results
}
