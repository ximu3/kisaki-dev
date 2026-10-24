// Parse synthetic Lua data through a pinned AST parser; never run the Lua input.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import vm from 'node:vm'

const root = new URL('./', import.meta.url)
const tarballUrl = 'https://registry.npmjs.org/luaparse/-/luaparse-0.3.1.tgz'
const integrity =
  'b21h2bFEbtGXmVqguHogbyrMAA0wOHyp9u/rx+w6Yc9pW1t9YjhGUsp87lYcp7pFRqSWN/PhFkrdIqKEUzRjjQ=='
const moduleSha256 = '1c70940a6e46be63c84c285036925715f110bf06cbf058922372fb5c9d060b27'
const response = await fetch(tarballUrl, { signal: AbortSignal.timeout(25000) })
assert.equal(response.status, 200)
const compressed = Buffer.from(await response.arrayBuffer())
assert.equal(createHash('sha512').update(compressed).digest('base64'), integrity)
const archive = gunzipSync(compressed, { maxOutputLength: 1024 * 1024 })
let moduleBytes
for (let offset = 0; offset + 512 <= archive.length;) {
  const name = archive
    .subarray(offset, offset + 100)
    .toString('utf8')
    .split('\0')[0]
  if (!name) break
  const size = Number.parseInt(
    archive
      .subarray(offset + 124, offset + 136)
      .toString('ascii')
      .replaceAll('\0', '')
      .trim(),
    8
  )
  assert.ok(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= archive.length)
  if (name === 'package/luaparse.js') {
    assert.equal(moduleBytes, undefined)
    moduleBytes = archive.subarray(offset + 512, offset + 512 + size)
  }
  offset += 512 + Math.ceil(size / 512) * 512
}
assert.ok(moduleBytes)
assert.equal(createHash('sha256').update(moduleBytes).digest('hex'), moduleSha256)
const common = { exports: {} }
const context = vm.createContext(
  { module: common, exports: common.exports },
  { codeGeneration: { strings: false, wasm: false } }
)
new vm.Script(moduleBytes.toString('utf8'), { filename: 'luaparse-0.3.1.js' }).runInContext(
  context,
  { timeout: 1000 }
)
const parser = common.exports
assert.equal(typeof parser.parse, 'function')
const dependency = {
  name: 'luaparse',
  version: '0.3.1',
  registry: 'https://registry.npmjs.org/luaparse/0.3.1',
  tarball: tarballUrl,
  integrity: 'sha512-' + integrity,
  moduleSha256,
  moduleBytes: moduleBytes.length,
  checkedAt: new Date().toISOString(),
  license: 'MIT',
  parserCodeExecuted: true,
  luaCodeExecuted: false
}
await writeFile(
  new URL('dependency-contract.json', root),
  JSON.stringify(dependency, null, 2) + '\n'
)

function parseData(bytes, limits = {}) {
  const budget = {
    bytes: 8 * 1024 * 1024,
    nodes: 100000,
    depth: 48,
    string: 1024 * 1024,
    ...limits
  }
  assert.ok(bytes.length <= budget.bytes)
  let nodes = 0
  const ast = parser.parse(bytes.toString('latin1'), {
    luaVersion: '5.1',
    encodingMode: 'pseudo-latin1',
    comments: false,
    onCreateNode() {
      assert.ok(++nodes <= budget.nodes)
    }
  })
  assert.equal(ast.body.length, 1)
  const statement = ast.body[0]
  assert.equal(statement.type, 'ReturnStatement')
  assert.equal(statement.arguments.length, 1)
  assert.equal(statement.arguments[0].type, 'TableConstructorExpression')
  function value(node, depth) {
    assert.ok(depth <= budget.depth)
    switch (node.type) {
      case 'StringLiteral':
        assert.ok(typeof node.value === 'string' && node.value.length <= budget.string)
        return node.value
      case 'NumericLiteral':
        assert.ok(Number.isFinite(node.value))
        return node.value
      case 'BooleanLiteral':
        return node.value
      case 'NilLiteral':
        return null
      case 'UnaryExpression':
        assert.equal(node.operator, '-')
        assert.equal(node.argument.type, 'NumericLiteral')
        return -value(node.argument, depth + 1)
      case 'TableConstructorExpression': {
        const table = new Map()
        const seen = new Set()
        let implicit = 0
        for (const field of node.fields) {
          let key
          if (field.type === 'TableValue') key = ++implicit
          else if (field.type === 'TableKeyString') {
            assert.equal(field.key.type, 'Identifier')
            key = field.key.name
          } else {
            assert.equal(field.type, 'TableKey')
            key = value(field.key, depth + 1)
            assert.ok(['number', 'string', 'boolean'].includes(typeof key))
          }
          assert.ok(!seen.has(key), 'Duplicate key')
          seen.add(key)
          const item = value(field.value, depth + 1)
          if (item !== null) table.set(key, item)
        }
        return table
      }
      default:
        throw new Error('Unsupported Lua data expression.')
    }
  }
  return value(statement.arguments[0], 0)
}
const decoder = new TextDecoder('utf-8', { fatal: true })
const text = (raw) => decoder.decode(Buffer.from(raw, 'latin1'))
function decoded(value) {
  if (value instanceof Map)
    return {
      $lua: [...value].map(([key, item]) => [
        typeof key === 'string' ? text(key) : key,
        decoded(item)
      ])
    }
  return typeof value === 'string' ? text(value) : value
}
const checks = []
function check(name, action) {
  try {
    action()
    checks.push({ name, passed: true })
  } catch (error) {
    checks.push({ name, passed: false, detail: error.message.slice(0, 240) })
  }
}
const manifest = JSON.parse(await readFile(new URL('fixture-manifest.json', root), 'utf8'))
const valid = parseData(await readFile(new URL('fixtures/grammar/valid.lua', root)))
check('UTF-8 literal bytes survive the Latin-1 parser bridge', () =>
  assert.equal(text(valid.get('name')), '星光🌙')
)
check('Decimal byte escapes decode as UTF-8', () => assert.equal(text(valid.get('escaped')), '星'))
check('Long bracket strings preserve newlines', () =>
  assert.equal(text(valid.get('long')), 'line one\nline two')
)
check('Nil-valued keys are absent', () => assert.equal(valid.has('nil_value'), false))
check('Boolean and negative literals retain type', () =>
  assert.deepEqual([valid.get('yes'), valid.get('no'), valid.get('negative')], [true, false, -3])
)
check('Numeric and textual keys stay distinct', () =>
  assert.deepEqual([valid.get(1), valid.get('1')], ['numeric', 'string'])
)
check('Prototype-like keys are ordinary Map data', () => {
  assert.equal(valid.get('__proto__').get('polluted'), true)
  assert.equal({}.polluted, undefined)
})
check('Code-looking string remains inert data', () =>
  assert.equal(text(valid.get('code_text')), "os.execute('never')")
)
for (const fixture of manifest.files.filter((file) => file.path.includes('/grammar/reject-'))) {
  const bytes = await readFile(new URL(fixture.path, root))
  check('Reject ' + fixture.path.split('/').pop(), () => assert.throws(() => parseData(bytes)))
}
const invalidText = parseData(await readFile(new URL('fixtures/grammar/invalid-text.lua', root)))
check('Invalid optional text does not invalidate other decoded fields', () =>
  assert.equal(text(invalidText.get('valid')), 'fine')
)
check('Invalid UTF-8 is rejected when that text is adopted', () =>
  assert.throws(() => text(invalidText.get('bad')))
)
check('Input byte budget', () =>
  assert.throws(() => parseData(Buffer.from('return {}'), { bytes: 2 }))
)
check('AST node budget', () =>
  assert.throws(() => parseData(Buffer.from('return {1, 2, 3}'), { nodes: 3 }))
)
check('String budget', () =>
  assert.throws(() => parseData(Buffer.from('return {"abc"}'), { string: 2 }))
)
const sourceTables = {}
for (const fixture of manifest.files.filter(
  (file) => file.path.endsWith('.lua') && !file.path.includes('/grammar/')
)) {
  const bytes = await readFile(new URL(fixture.path, root))
  check('Parse current data ' + fixture.path, () => {
    sourceTables[fixture.path] = decoded(parseData(bytes))
  })
}
await writeFile(new URL('parsed-fixtures.json', root), JSON.stringify(sourceTables, null, 2) + '\n')
for (const fixture of manifest.files) {
  const bytes = await readFile(new URL(fixture.path, root))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), fixture.sha256)
}
check('All fixture input bytes remain unchanged', () =>
  assert.equal(Object.keys(sourceTables).length, 6)
)
const result = {
  synthetic: true,
  parser: dependency.name + '@' + dependency.version,
  luaCodeExecuted: false,
  sourceApplicationExecuted: false,
  productionImporterExecuted: false,
  checks,
  passed: checks.filter((check) => check.passed).length,
  failed: checks.filter((check) => !check.passed).length,
  allInputsUnchanged: true
}
await writeFile(new URL('lua-results.json', root), JSON.stringify(result, null, 2) + '\n')
console.log(
  JSON.stringify({
    passed: result.passed,
    failed: result.failed,
    output: fileURLToPath(new URL('lua-results.json', root))
  })
)
if (result.failed) process.exitCode = 1
