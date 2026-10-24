// Compare provenance with the unmodified parser and persist independently checked source boundaries.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { createMarkupMapper, SourceFailure } from './markup.mjs'
import { markupCases, chunks } from './cases.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const dependencyPath = path.join(root, 'node_modules/.cache/kana-formats/parse5.mjs')
const dependency = await import(pathToFileURL(dependencyPath))
const mapsPath = path.join(root, 'node_modules/.cache/kana-xml-input/encoding-maps.json')
const maps = JSON.parse(await readFile(mapsPath, 'utf8'))
const parse = createMarkupMapper(dependency, maps)
const hash = (value) => createHash('sha256').update(value).digest('hex')
const tree = (node) => ({
  name: node.nodeName,
  ...(node.namespaceURI ? { namespace: node.namespaceURI } : {}),
  ...(node.attrs ? { attributes: node.attrs } : {}),
  ...(node.value !== undefined ? { text: node.value } : {}),
  ...(node.data !== undefined ? { comment: node.data } : {}),
  ...(node.childNodes ? { children: node.childNodes.map(tree) } : {}),
  ...(node.content ? { content: tree(node.content) } : {})
})
function paths(node, prefix = 'root', result = new Map()) {
  result.set(node, prefix)
  node.childNodes?.forEach((child, index) => paths(child, `${prefix}/${index}`, result))
  if (node.content) paths(node.content, `${prefix}/template`, result)
  return result
}
const valid = (text, offset) =>
  !/[\uD800-\uDBFF]/.test(text[offset - 1] ?? '') || !/[\uDC00-\uDFFF]/.test(text[offset] ?? '')
const reject = (operation, reason) =>
  assert.throws(operation, (error) => error instanceof SourceFailure && error.reason === reason)
const records = []
let endpoints = 0
let forbiddenBytes = 0
for (const fixture of markupCases) {
  const bytes = new TextEncoder().encode(fixture.source)
  const reference = tree(dependency.parse(fixture.source, { scriptingEnabled: false }))
  let previous
  const attempts = []
  for (const chunk of chunks) {
    const result = parse(bytes, 'utf-8', chunk)
    assert.deepEqual(tree(result.tree), reference, fixture.name)
    const nodePaths = paths(result.tree)
    const observations = result.units.map((unit) => ({
      start: unit.byteStart,
      end: unit.byteEnd,
      value: unit.value,
      projections: unit.projections.map(({ node, offset }) => ({
        path: nodePaths.get(node),
        offset
      }))
    }))
    if (previous) assert.deepEqual(observations, previous, `${fixture.name}: chunk-dependent map`)
    previous = observations
    for (const unit of result.units) {
      for (let offset = 0; offset <= unit.value.length; offset++) {
        if (!valid(unit.value, offset)) {
          reject(() => result.resolve(unit.byteStart, offset), 'invalidBoundary')
          continue
        }
        if (!unit.projections.length) {
          reject(() => result.resolve(unit.byteStart, offset), 'locationUnavailable')
          continue
        }
        const point = result.resolve(unit.byteStart, offset)
        for (const projection of point.projections) {
          const saved = result.fromText(projection.node, projection.offset)
          const reopened = parse(bytes, 'utf-8', chunk === 1 ? 7 : 1)
          const restored = reopened.resolve(saved.byteOffset, saved.textOffset)
          const reopenedPaths = paths(reopened.tree)
          assert(
            restored.projections.some(
              (other) =>
                other.offset === projection.offset &&
                reopenedPaths.get(other.node) === nodePaths.get(projection.node)
            ),
            `${fixture.name}: reverse address did not restore`
          )
          endpoints++
        }
      }
      for (let inner = unit.byteStart + 1; inner < unit.byteEnd; inner++) {
        reject(() => result.resolve(inner, 0), 'invalidBoundary')
        forbiddenBytes++
      }
    }
    for (const tag of result.tags) {
      if (tag.nodes.length) {
        const point = result.resolve(tag.byteStart)
        assert.deepEqual(
          point.nodes.map((node) => nodePaths.get(node)),
          tag.nodes.map((node) => nodePaths.get(node))
        )
      } else reject(() => result.resolve(tag.byteStart), 'locationUnavailable')
    }
    attempts.push({
      chunk,
      textUnits: result.units.length,
      tags: result.tags.length,
      duplicatedElementOrigins: result.tags.filter((tag) => tag.nodes.length > 1).length,
      retainedTextUnits: result.units.filter((unit) => unit.projections.length).length
    })
  }
  records.push({
    name: fixture.name,
    sourceSha256: hash(bytes),
    unchangedTree: true,
    stableMap: true,
    attempts
  })
}
const foster = parse(
  new TextEncoder().encode(markupCases.find((item) => item.name === 'foster-parenting').source)
)
const table = foster.tags.find((tag) => tag.tagName === 'table').nodes[0]
const td = foster.tags.find((tag) => tag.tagName === 'td').nodes[0]
const before = foster.units.find((unit) => unit.value === 'b')
const after = foster.units.find(
  (unit) => unit.sourceStart >= fixtureTagEnd(foster.source, '</tr>') && unit.value === 'a'
)
function fixtureTagEnd(source, tag) {
  return source.indexOf(tag) + tag.length
}
assert(before.projections[0].node.parentNode === table.parentNode)
assert(after.projections[0].node.parentNode === table.parentNode)
assert(td.childNodes[0].value === 'cell')
const report = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  sources: Object.fromEntries(
    await Promise.all(
      ['cases.mjs', 'markup.mjs', 'run-node.mjs'].map(async (name) => [
        name,
        hash(await readFile(path.join(here, name)))
      ])
    )
  ),
  inputs: {
    parse5BundleSha256: hash(await readFile(dependencyPath)),
    encodingMapsSha256: hash(await readFile(mapsPath))
  },
  cases: records,
  checks: {
    restoredEndpoints: endpoints,
    rejectedInteriorBytes: forbiddenBytes,
    fosteredTextRetainsSourceOrder: true
  },
  limits: {
    fullHtmlConformance: false,
    fullReader: false,
    stylesAndVisibility: false,
    largeBookIndex: false
  }
}
await writeFile(path.join(here, 'node-contract.json'), JSON.stringify(report, null, 2) + '\n')
process.stdout.write(
  JSON.stringify({
    cases: records.length,
    attempts: records.length * chunks.length,
    endpoints,
    forbiddenBytes
  }) + '\n'
)
