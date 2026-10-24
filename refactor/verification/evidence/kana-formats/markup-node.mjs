// Validate byte starts and entity-local UTF-16 offsets over real raw MOBI/KF8 streams.
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { createMarkupMapper } from './markup-map.mjs'

const [cache, output] = process.argv.slice(2)
const parse5 = await import(pathToFileURL(path.resolve(cache, 'node_modules/parse5/dist/index.js')))
const encodingMaps = JSON.parse(await readFile(path.join(cache, 'oem-maps.json'), 'utf8'))
const parse = createMarkupMapper(parse5, encodingMaps)
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const mobi = JSON.parse(await readFile(path.join(cache, 'mobi-result.json'), 'utf8'))
const inputs = []
for (const run of mobi.runs)
  for (const branch of run.branches) {
    if (!branch.documents)
      inputs.push({
        name: `${run.name}.${branch.record}.raw`,
        encoding: branch.encoding === 65001 ? 'utf-8' : 'windows-1252',
        type: 'mobi'
      })
    else
      for (const document of branch.documents)
        inputs.push({
          name: document.rawFile,
          encoding: branch.encoding === 65001 ? 'utf-8' : 'windows-1252',
          type: 'kf8',
          documentIndex: document.documentIndex
        })
  }
const controlled =
  '<!doctype html><html><head><style>.a::after{content:"&amp;"}</style></head><body><p>甲😀A&amp;B&NotEqualTilde;&#x1F600;\r\n é</p><table>before<tr><td>cell</td></tr>after</table><pre>\nfirst\n</pre><p><b>x<i>y</b>z</i></p></body></html>'
await writeFile(path.join(cache, 'mobi/controlled.html'), controlled)
inputs.push({ name: 'controlled.html', encoding: 'utf-8', type: 'mobi', controlled: true })
const runs = []
for (const item of inputs) {
  const bytes = await readFile(path.join(cache, 'mobi', item.name))
  const parsed = parse(bytes, item.encoding, 7)
  const reopened = parse(bytes, item.encoding, 4096)
  let checked = 0,
    rejectedInsideBytes = 0,
    multiUnitEntity = 0,
    rejectedSurrogates = 0
  for (const unit of parsed.units) {
    for (let offset = 0; offset <= unit.value.length; offset++) {
      const before = unit.value.charCodeAt(offset - 1),
        after = unit.value.charCodeAt(offset)
      if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff) {
        let rejected = false
        try {
          parsed.resolve(unit.byteStart, offset)
        } catch (error) {
          rejected = error.reason === 'invalidBoundary'
        }
        assert(rejected, 'A byte address split a UTF-16 surrogate pair')
        rejectedSurrogates++
        continue
      }
      const anchor = JSON.parse(
        JSON.stringify({
          type: item.type,
          ...(item.type === 'kf8' ? { documentIndex: item.documentIndex } : {}),
          byteOffset: unit.byteStart,
          textOffset: offset
        })
      )
      const a = parsed.resolve(anchor.byteOffset, anchor.textOffset),
        b = reopened.resolve(anchor.byteOffset, anchor.textOffset)
      const remaining = unit.value.slice(offset)
      assert(
        a.node.value === b.node.value && a.offset === b.offset,
        'Restored text node boundary differs'
      )
      assert(
        a.node.value.slice(a.offset, a.offset + remaining.length) === remaining &&
          b.node.value.slice(b.offset, b.offset + remaining.length) === remaining,
        'Byte address changed across input chunks'
      )
      checked++
    }
    if (unit.byteEnd - unit.byteStart > 1) {
      let rejected = false
      try {
        parsed.resolve(unit.byteStart + 1)
      } catch (error) {
        if (error.reason === 'invalidBoundary') {
          rejectedInsideBytes++
          rejected = true
        }
      }
      assert(rejected, 'A byte inside a source character or reference was accepted')
    }
    if (unit.value.length > 1 && unit.byteEnd - unit.byteStart > 4) multiUnitEntity++
  }
  const nodeOrder = []
  function visit(node) {
    if (node.nodeName === '#text') nodeOrder.push(node)
    for (const child of node.childNodes ?? []) visit(child)
    if (node.content) visit(node.content)
  }
  visit(parsed.tree)
  const reordered = parsed.units.some(
    (unit, index) =>
      index > 0 && nodeOrder.indexOf(unit.node) < nodeOrder.indexOf(parsed.units[index - 1].node)
  )
  if (item.controlled) {
    assert(
      reordered && multiUnitEntity > 0,
      'Controlled HTML did not exercise entity expansion and source/display reordering'
    )
    const start = bytes.indexOf(Buffer.from('\r\n'))
    const cr = parsed.resolve(start, 1),
      lf = parsed.resolve(start + 1, 0)
    assert(
      cr.node === lf.node && cr.offset === lf.offset,
      'The consumed LF lost its valid source boundary'
    )
  }
  runs.push({
    ...item,
    sourceBytes: bytes.length,
    sourceUnits: parsed.units.length,
    checkedAddresses: checked,
    rejectedInsideBytes,
    multiUnitEntity,
    rejectedSurrogates,
    zeroWidthSourceUnits: parsed.units.filter((unit) => !unit.value).length,
    sourceAndDisplayOrderDiffer: reordered,
    originalInsertions: parsed.insertionCount,
    reopenedInsertions: reopened.insertionCount
  })
}
await writeFile(
  output,
  JSON.stringify(
    {
      runs,
      parserInternalSeamUsed: 'Tokenizer emissions + _insertCharacters + treeAdapter',
      fullMarkupMappingProved: false,
      displayReaderExecuted: false,
      allAssertionsPassed: true
    },
    null,
    2
  ) + '\n'
)
process.stdout.write(
  JSON.stringify({
    streams: runs.length,
    checkedAddresses: runs.reduce((sum, run) => sum + run.checkedAddresses, 0)
  }) + '\n'
)
