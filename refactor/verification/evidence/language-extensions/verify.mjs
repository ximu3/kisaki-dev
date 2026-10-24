/** Exercise real ICU dependencies and a bounded model of the proposed translation contract. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const repo = resolve(root, '../../../..')
const dependencyRoot = process.argv[2]
if (!dependencyRoot) throw new Error('Provide the isolated proof dependency directory.')
const dependencyRequire = createRequire(join(resolve(dependencyRoot), 'package.json'))
const localRequire = createRequire(import.meta.url)
const { IntlMessageFormat } = await import(
  pathToFileURL(dependencyRequire.resolve('intl-messageformat')).href
)
const { parse, TYPE } = await import(
  pathToFileURL(dependencyRequire.resolve('@formatjs/icu-messageformat-parser')).href
)
const { match } = await import(
  pathToFileURL(dependencyRequire.resolve('@formatjs/intl-localematcher')).href
)
const ts = localRequire('typescript')
const checks = []
const samples = []
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const check = (name, operation) => {
  try {
    operation()
    checks.push({ name, passed: true })
  } catch (error) {
    checks.push({ name, passed: false, diagnostic: error.message })
  }
}
const rejects = (name, operation) => check(name, () => assert.throws(operation))

function flatten(catalog, limits = { nodes: 10000, length: 10000, depth: 20 }) {
  const output = new Map()
  const seen = new Set()
  let nodes = 0
  function visit(value, path, depth) {
    if (++nodes > limits.nodes || depth > limits.depth) throw new Error('Catalog budget exceeded.')
    if (typeof value === 'string') {
      if (!path || value.length > limits.length) throw new Error('Invalid message leaf.')
      output.set(path, value)
      return
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Catalog groups must be plain data objects.')
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value)) || seen.has(value))
      throw new Error('Invalid catalog object.')
    seen.add(value)
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!key || key.includes('.') || !Object.hasOwn(descriptor, 'value'))
        throw new Error('Invalid catalog key or accessor.')
      visit(descriptor.value, path ? `${path}.${key}` : key, depth + 1)
    }
    seen.delete(value)
  }
  visit(catalog, '', 0)
  return output
}

function parameters(message) {
  const types = new Map()
  function add(name, allowed) {
    const previous = types.get(name)
    const merged = previous ? allowed.filter((value) => previous.includes(value)) : allowed
    if (!merged.length) throw new Error('Incompatible parameter uses in one message.')
    types.set(name, merged)
  }
  function walk(elements) {
    for (const node of elements) {
      switch (node.type) {
        case TYPE.literal:
        case TYPE.pound:
          break
        case TYPE.argument:
          add(node.value, ['string', 'number'])
          break
        case TYPE.number:
          add(node.value, ['number'])
          break
        case TYPE.date:
        case TYPE.time:
          add(node.value, ['Date', 'number'])
          break
        case TYPE.select:
          add(node.value, ['string'])
          for (const branch of Object.values(node.options)) walk(branch.value)
          break
        case TYPE.plural:
          add(node.value, ['number'])
          for (const branch of Object.values(node.options)) walk(branch.value)
          break
        default:
          throw new Error('Message must produce plain text.')
      }
    }
  }
  walk(parse(message, { ignoreTag: true }))
  return types
}

const catalogs = {}
const fixtureHashes = []
for (const locale of ['en', 'zh-Hans', 'zh-Hant', 'ja']) {
  const filename = `fixtures/${locale}.json`
  const bytes = await readFile(join(root, filename))
  catalogs[locale] = JSON.parse(bytes)
  fixtureHashes.push({ path: filename, bytes: bytes.length, sha256: hash(bytes) })
}
const english = flatten(catalogs.en)
const contract = new Map([...english].map(([key, message]) => [key, parameters(message)]))
const projectBytes = await readFile(join(root, 'fixtures/projects.json'))
const projects = JSON.parse(projectBytes)
fixtureHashes.push({
  path: 'fixtures/projects.json',
  bytes: projectBytes.length,
  sha256: hash(projectBytes)
})
check('Three projects have distinct stable extension and translation identities', () => {
  assert.deepEqual(
    projects.map((project) => project.ordinal),
    [31, 32, 33]
  )
  assert.equal(new Set(projects.map((project) => project.extensionId)).size, 3)
  assert.equal(new Set(projects.map((project) => project.translationId)).size, 3)
  for (const project of projects)
    assert.match(
      project.extensionId,
      /^[a-z](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z](?:[a-z0-9-]*[a-z0-9])?)*$/
    )
})
check('Each portable language project explicitly covers the six desktop targets', () => {
  const expected = [
    'windows-x64',
    'windows-arm64',
    'macos-x64',
    'macos-arm64',
    'linux-x64',
    'linux-arm64'
  ].sort()
  for (const project of projects) assert.deepEqual([...project.targets].sort(), expected)
})

function validate(catalog, official = false) {
  const leaves = flatten(catalog)
  if (
    official &&
    (leaves.size !== english.size || [...english.keys()].some((key) => !leaves.has(key)))
  ) {
    throw new Error('Official catalog must cover the complete English baseline.')
  }
  for (const [key, message] of leaves) {
    const baseline = contract.get(key)
    if (!baseline) continue
    const translated = parameters(message)
    for (const [name, accepted] of translated) {
      const supplied = baseline.get(name)
      if (!supplied || supplied.some((type) => !accepted.includes(type)))
        throw new Error('Translation changes the public parameter contract.')
    }
  }
  return leaves
}

function requireValues(key, values = {}) {
  const expected = contract.get(key)
  if (!expected) throw new Error('Unknown English message key.')
  for (const [name, types] of expected) {
    if (!Object.hasOwn(values, name)) throw new Error('Required message argument is missing.')
    const value = values[name]
    const type = value instanceof Date ? 'Date' : typeof value
    if (!types.includes(type)) throw new Error('Message argument type does not match.')
  }
}

const formats = {
  date: { short: { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' } }
}
function format(message, locale, values) {
  const result = new IntlMessageFormat(message, locale, formats, { ignoreTag: true }).format(values)
  if (typeof result !== 'string') throw new Error('Expected a text message.')
  return result
}

function canonicalLocale(input) {
  const locale = new Intl.Locale(input)
  if (
    locale.toString() !== locale.baseName ||
    !Intl.NumberFormat.supportedLocalesOf([locale.baseName]).length
  ) {
    throw new Error('Locale must be a supported canonical base language tag.')
  }
  return locale.baseName
}

function localizedText(text, defaultLocale, requested) {
  if (typeof text === 'string') return text
  const values = new Map()
  for (const [key, value] of Object.entries(text)) {
    const canonical = canonicalLocale(key)
    if (values.has(canonical) || typeof value !== 'string')
      throw new Error('Invalid localized text.')
    values.set(canonical, value)
  }
  const fallback = canonicalLocale(defaultLocale)
  if (!values.has(fallback)) throw new Error('Default localized text is missing.')
  const wanted = canonicalLocale(requested)
  if (values.has(wanted)) return values.get(wanted)
  const identity = new Intl.Locale(wanted).maximize()
  const candidates = [...values.keys()]
    .filter((key) => {
      const candidate = new Intl.Locale(key).maximize()
      return candidate.language === identity.language && candidate.script === identity.script
    })
    .sort()
  return candidates.length
    ? values.get(match([wanted], candidates, candidates[0]))
    : values.get(fallback)
}

// This model has no RPC, database, extension process, timer, or UI implementation.
class TranslationModel {
  selected = { type: 'builtin', id: 'en' }
  registrations = new Map()
  generation = 0
  revision = 0
  draft = { title: 'User title', note: 'User-authored text' }
  key(reference) {
    return JSON.stringify(reference)
  }
  activate(extensionId, definitions, failAfterRegistration = false) {
    const ownerGeneration = ++this.generation
    const staged = []
    for (const definition of definitions) {
      const ref = { type: 'extension', extensionId, id: definition.id }
      const key = this.key(ref)
      if (this.registrations.has(key) || staged.some((entry) => entry.key === key))
        throw new Error('Duplicate registration identity.')
      staged.push({
        key,
        ref,
        generation: ownerGeneration,
        locale: canonicalLocale(definition.locale),
        messages: validate(definition.messages)
      })
    }
    if (failAfterRegistration) throw new Error('Synthetic activation failure.')
    for (const entry of staged) this.registrations.set(entry.key, entry)
    this.revision++
    return staged.map((entry) => ({
      ref: entry.ref,
      dispose: () => {
        if (this.registrations.get(entry.key) === entry) {
          this.registrations.delete(entry.key)
          this.revision++
        }
      }
    }))
  }
  choose(reference) {
    if (reference.type !== 'builtin' && !this.registrations.has(this.key(reference)))
      throw new Error('New selection is not ready.')
    this.selected = structuredClone(reference)
    this.revision++
  }
  effective() {
    return this.registrations.get(this.key(this.selected)) ?? { locale: 'en', messages: english }
  }
  t(key, values) {
    requireValues(key, values)
    const current = this.effective()
    return current.messages.has(key)
      ? format(current.messages.get(key), current.locale, values)
      : format(english.get(key), 'en', values)
  }
}

for (const locale of Object.keys(catalogs)) {
  check(`${locale}: all English fixture keys are present and type-compatible`, () =>
    assert.equal(validate(catalogs[locale], true).size, english.size)
  )
  const leaves = flatten(catalogs[locale])
  for (const count of [0, 1, 2, 1234]) {
    check(`${locale}: actual ICU count ${count}`, () => {
      const output = format(leaves.get('selection.count'), locale, { count })
      assert.ok(output.length > 0)
      assert.ok(!output.includes('{count'))
      samples.push({ locale, key: 'selection.count', values: { count }, output })
    })
  }
  check(`${locale}: unknown select value uses an explicit other branch`, () =>
    assert.ok(format(leaves.get('library.kind'), locale, { kind: 'future-type' }).length)
  )
  check(`${locale}: arguments are not recursively interpreted as ICU`, () =>
    assert.ok(
      format(leaves.get('library.added'), locale, { name: '{count} <img src=x> 🌙' }).includes(
        '{count} <img src=x> 🌙'
      )
    )
  )
  check(`${locale}: escaped braces are literal and declare no argument`, () => {
    assert.equal(parameters(leaves.get('feedback.escaped')).size, 0)
    assert.ok(format(leaves.get('feedback.escaped'), locale).includes('{name}'))
  })
  check(`${locale}: markup is a literal text value`, () =>
    assert.equal(
      format(leaves.get('feedback.literalMarkup'), locale, { name: 'Test' }),
      '<b>Test</b>'
    )
  )
  check(`${locale}: Date and epoch milliseconds format identically`, () => {
    const date = new Date('2026-10-17T12:00:00Z')
    assert.equal(
      format(leaves.get('feedback.updated'), locale, { when: date }),
      format(leaves.get('feedback.updated'), locale, { when: date.getTime() })
    )
  })
  check(`${locale}: an unformatted numeric argument supports zero`, () =>
    assert.ok(format(leaves.get('feedback.value'), locale, { value: 0 }).includes('0'))
  )
  check(`${locale}: live execution and personal reading state have different labels`, () =>
    assert.notEqual(leaves.get('records.running'), leaves.get('records.active.game'))
  )
  check(`${locale}: favorite and collection stay distinct`, () =>
    assert.notEqual(leaves.get('library.favorite'), leaves.get('library.collection'))
  )
}
check('English plural uses the English one branch', () =>
  assert.equal(format(english.get('selection.count'), 'en', { count: 1 }), '1 item selected')
)
check('English selectordinal preserves ordinal rules', () =>
  assert.deepEqual(
    [1, 2, 3, 4, 21].map((position) =>
      format(english.get('selection.position'), 'en', { position })
    ),
    ['1st', '2nd', '3rd', '4th', '21st']
  )
)
check('English offset and pound are handled by the real ICU engine', () =>
  assert.equal(
    format(english.get('selection.shared'), 'en', { name: 'A', count: 3 }),
    'A and 2 other people'
  )
)
check('Translation may omit a baseline argument', () =>
  assert.ok(validate({ library: { added: 'Added' } }))
)
check('Translation may replace number formatting with plain interpolation', () =>
  assert.ok(validate({ selection: { count: '{count}' } }))
)
rejects('Translation cannot narrow an ordinary argument to number', () =>
  validate({ feedback: { value: '{value, number}' } })
)
rejects('Translation cannot require a new parameter', () =>
  validate({ library: { added: '{otherName}' } })
)
rejects('Translation cannot format a number parameter as select text', () =>
  validate({ selection: { count: '{count, select, one {One} other {Other}}' } })
)
rejects('Translation cannot format a Date-capable argument as plain interpolation', () =>
  validate({ feedback: { updated: '{when}' } })
)
rejects('Known malformed ICU rejects the entire catalog', () =>
  validate({ actions: { save: 'Save' }, selection: { count: '{count, plural, one {One}}' } })
)
rejects('An English parameter cannot require incompatible string and number values', () =>
  parameters('{value, number} {value, select, one {One} other {Other}}')
)
check('Compatible English uses derive the intersection of allowed types', () =>
  assert.deepEqual(parameters('{value} {value, number}').get('value'), ['number'])
)
check('All select branches contribute to the static parameter contract', () =>
  assert.deepEqual(
    [...parameters('{kind, select, a {{name}} other {{count, number}}}').keys()].sort(),
    ['count', 'kind', 'name']
  )
)
check('Select branches do not form a closed enum', () =>
  assert.deepEqual(parameters(english.get('library.kind')).get('kind'), ['string'])
)
check('Runtime allows missing keys for English fallback', () =>
  assert.equal(validate({ actions: { save: '儲存' } }).size, 1)
)
rejects('Official build rejects a partial catalog', () =>
  validate({ actions: { save: '儲存' } }, true)
)
check('Unknown future ICU leaf is ignored by the current runtime', () =>
  assert.ok(validate({ future: { label: '{invalid' } }))
)
rejects('Official build rejects extra unknown keys', () =>
  validate({ ...catalogs.ja, future: { label: 'Future' } }, true)
)
for (const [name, value] of [
  ['array', []],
  ['function', () => 'text'],
  ['null', null],
  ['number', 1]
]) {
  rejects(`Catalog rejects ${name} leaves`, () => validate({ actions: { save: value } }))
}
rejects('A dotted segment does not masquerade as a nested path', () =>
  validate({ 'actions.save': 'Save' })
)
let getterCalled = false
const accessor = Object.defineProperty({}, 'save', {
  enumerable: true,
  get() {
    getterCalled = true
    return 'Save'
  }
})
rejects('Catalog accessors are not evaluated', () => validate({ actions: accessor }))
check('The rejected accessor never executed', () => assert.equal(getterCalled, false))
const cycle = {}
cycle.self = cycle
rejects('Catalog object cycles are rejected', () => flatten(cycle))
rejects('Catalog depth budget is enforced', () =>
  flatten({ a: { b: { c: 'value' } } }, { nodes: 50, length: 50, depth: 2 })
)
rejects('Individual message length budget is enforced', () =>
  flatten({ a: 'longer' }, { nodes: 50, length: 3, depth: 5 })
)
check('Own prototype-looking keys never mutate prototypes', () => {
  const leaves = flatten(JSON.parse('{"__proto__":{"polluted":"value"}}'))
  assert.equal(leaves.get('__proto__.polluted'), 'value')
  assert.equal({}.polluted, undefined)
})
check('Locale casing is canonicalized', () => assert.equal(canonicalLocale('ZH-hant'), 'zh-Hant'))
check('UI locales remain open beyond the four official languages', () =>
  assert.equal(canonicalLocale('fr-CA'), 'fr-CA')
)
for (const locale of [
  'zh_Hant',
  'ja-u-ca-japanese',
  'zh-Hans-u-nu-hanidec',
  'en-x-custom',
  'zz-ZZ'
]) {
  rejects(`Reject unsupported or option-bearing UI locale ${locale}`, () => canonicalLocale(locale))
}
check('LocalizedText chooses an exact supplied regional value first', () =>
  assert.equal(
    localizedText({ en: 'English', 'zh-Hant': '繁體', 'zh-TW': '台灣' }, 'en', 'zh-TW'),
    '台灣'
  )
)
check('A regional Traditional Chinese request can select a supplied Hant value', () =>
  assert.equal(localizedText({ en: 'English', 'zh-Hant': '繁體' }, 'en', 'zh-TW'), '繁體')
)
check('A regional Simplified Chinese request can select a supplied Hans value', () =>
  assert.equal(localizedText({ en: 'English', 'zh-Hans': '简体' }, 'en', 'zh-CN'), '简体')
)
check('Hans does not use Hant as a compatible script match', () =>
  assert.equal(localizedText({ en: 'English', 'zh-Hant': '繁體' }, 'en', 'zh-Hans'), 'English')
)
check('The author default can still be Hant without claiming script equivalence', () =>
  assert.equal(localizedText({ 'zh-Hant': '作者預設' }, 'zh-Hant', 'zh-Hans'), '作者預設')
)
check('LocalizedText does not interpolate ICU placeholders', () =>
  assert.equal(localizedText('Plain {name}', 'en', 'ja'), 'Plain {name}')
)
check('LocalizedText candidate ordering is deterministic', () =>
  assert.equal(
    localizedText({ 'zh-HK': 'HK', 'zh-TW': 'TW', en: 'EN' }, 'en', 'zh-Hant'),
    localizedText({ en: 'EN', 'zh-TW': 'TW', 'zh-HK': 'HK' }, 'en', 'zh-Hant')
  )
)
rejects('Canonical duplicate locale names are rejected', () =>
  localizedText({ en: 'English', 'ZH-hant': 'A', 'zh-Hant': 'B' }, 'en', 'zh-Hant')
)
rejects('LocalizedText must contain its explicit default', () =>
  localizedText({ ja: '日本語' }, 'en', 'ja')
)

const model = new TranslationModel()
const definition = (id, locale, messages) => ({ id, locale, messages })
check('Zero extensions retain the complete English baseline', () =>
  assert.equal(model.t('actions.save'), 'Save')
)
const [hans] = model.activate(projects[0].extensionId, [
  definition(projects[0].translationId, projects[0].locale, catalogs['zh-Hans'])
])
check('Installation and registration do not choose a language', () =>
  assert.equal(model.effective().locale, 'en')
)
model.choose(hans.ref)
check('Explicit selection adopts the selected Chinese catalog', () =>
  assert.equal(model.t('actions.save'), '保存')
)
const draft = structuredClone(model.draft)
const [hant] = model.activate(projects[1].extensionId, [
  definition(projects[1].translationId, projects[1].locale, catalogs['zh-Hant'])
])
model.choose(hant.ref)
check('Switching to Hant uses its independently authored wording', () =>
  assert.equal(model.t('actions.save'), '儲存')
)
check('Switching preserves user-owned draft text', () => assert.deepEqual(model.draft, draft))
const [alternate] = model.activate('community-hant', [
  definition('concise', 'zh-Hant', { actions: { save: '保存草稿' } })
])
const priorRevision = model.revision
model.choose(alternate.ref)
check('Same-locale translation switch changes the rendered message', () =>
  assert.equal(model.t('actions.save'), '保存草稿')
)
check('Same-locale switch still invalidates message presentation', () =>
  assert.ok(model.revision > priorRevision)
)
check('Missing keys fall back to English grammar, not selected Chinese grammar', () =>
  assert.equal(model.t('selection.count', { count: 1 }), '1 item selected')
)
check('Missing keys do not borrow the other installed Hant translation', () =>
  assert.equal(model.t('actions.browse'), 'Browse…')
)
const savedRef = structuredClone(model.selected)
alternate.dispose()
check('Withdrawal reverts effective language to English', () =>
  assert.equal(model.effective().locale, 'en')
)
check('Withdrawal keeps the saved translation identity', () =>
  assert.deepEqual(model.selected, savedRef)
)
const [recovered] = model.activate('community-hant', [
  definition('concise', 'zh-Hant', { actions: { save: '再次儲存' } })
])
check('The exact saved translation automatically recovers when it returns', () =>
  assert.equal(model.t('actions.save'), '再次儲存')
)
alternate.dispose()
check('A stale registration disposer cannot revoke a replacement', () =>
  assert.equal(model.t('actions.save'), '再次儲存')
)
const selectedBeforeFailure = structuredClone(model.selected)
rejects('A newly chosen unavailable translation is not saved', () =>
  model.choose({ type: 'extension', extensionId: 'missing', id: 'missing' })
)
check('Failed selection keeps the previous saved choice', () =>
  assert.deepEqual(model.selected, selectedBeforeFailure)
)
const sizeBeforeFailure = model.registrations.size
rejects('Activation failure does not publish its staged translations', () =>
  model.activate('failed-language', [definition('first', 'ja', catalogs.ja)], true)
)
check('Failed activation leaves the published registry unchanged', () =>
  assert.equal(model.registrations.size, sizeBeforeFailure)
)
rejects('One invalid known message rejects all staged contributions', () =>
  model.activate('invalid-language', [
    definition('valid', 'ja', catalogs.ja),
    definition('bad', 'ja', { actions: { save: '{bad' } })
  ])
)
check('Partially valid activation publishes no subset', () =>
  assert.equal(model.registrations.size, sizeBeforeFailure)
)
rejects('Duplicate identity is not a load-order override', () =>
  model.activate('community-hant', [definition('concise', 'zh-Hant', catalogs['zh-Hant'])])
)
rejects('Missing call arguments remain a programming error', () => model.t('selection.count'))
rejects('Wrong call argument type does not cause a language fallback', () =>
  model.t('selection.count', { count: '2' })
)
rejects('Unknown keys cannot be rendered through an escape overload', () =>
  model.t('future.message')
)
const [empty] = model.activate('empty-language', [
  definition('empty', 'ja', { actions: { save: '' } })
])
model.choose(empty.ref)
check('A present empty string is distinct from a missing message', () =>
  assert.equal(model.t('actions.save'), '')
)
model.choose({ type: 'builtin', id: 'en' })
check('Returning to English does not disable installed translations', () =>
  assert.ok(model.registrations.has(model.key(recovered.ref)))
)

const typeLines = [
  '// Generated only from the synthetic English ICU fixture.',
  'interface MessageArguments {'
]
for (const [key, types] of contract) {
  typeLines.push(
    `  ${JSON.stringify(key)}: { ${[...types].map(([name, allowed]) => `${JSON.stringify(name)}: ${allowed.join(' | ')}`).join('; ')} }`
  )
}
typeLines.push(
  '}',
  'type MessageKey = keyof MessageArguments',
  'type MessageCall = { [K in MessageKey]: keyof MessageArguments[K] extends never ? [key: K] : [key: K, values: MessageArguments[K]] }[MessageKey]',
  'declare function t(...args: MessageCall): string',
  "t('actions.save')",
  "t('selection.count', {count: 2})",
  "t('library.kind', {kind: 'future-value'})",
  "t('feedback.updated', {when: new Date()})",
  "t('feedback.updated', {when: 1792238400000})"
)
for (const line of [
  "t('actions')",
  "t('unknown.key')",
  "t('selection.count')",
  "t('selection.count', {count: '2'})",
  "t('feedback.updated', {when: 'yesterday'})",
  "t('actions.save', {name: 'extra'})"
]) {
  typeLines.push('// @ts-expect-error This call violates the generated baseline contract.', line)
}
typeLines.push(
  "declare const uncertainKey: 'selection.count' | 'library.added'",
  'declare const uncertainArguments: {count: number} | {name: string}',
  '// @ts-expect-error Independent unions cannot prove key-to-argument correlation.',
  't(uncertainKey, uncertainArguments)'
)
const typeFile = join(root, 'generated-contract.test.ts')
await writeFile(typeFile, `${typeLines.join('\n')}\n`)
const program = ts.createProgram([typeFile], {
  strict: true,
  noEmit: true,
  types: [],
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  skipLibCheck: true
})
const diagnostics = ts.getPreEmitDiagnostics(program)
check('Generated ICU call types accept valid calls and reject seven invalid cases', () =>
  assert.equal(
    diagnostics.length,
    0,
    diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n')
  )
)

const inventory = []
for (const locale of ['en', 'zh-hans', 'zh-hant', 'ja']) {
  const directory = join(repo, 'apps/desktop/src/shared/i18n/messages', locale)
  const files = (await readdir(directory))
    .filter((name) => name.endsWith('.ts') && name !== 'index.ts')
    .sort()
  const leaves = new Map()
  const sourceFiles = []
  for (const name of files) {
    const bytes = await readFile(join(directory, name))
    const source = ts.createSourceFile(name, bytes.toString('utf8'), ts.ScriptTarget.Latest, true)
    sourceFiles.push({
      path: `apps/desktop/src/shared/i18n/messages/${locale}/${name}`,
      bytes: bytes.length,
      sha256: hash(bytes)
    })
    function unwrap(node) {
      while (
        ts.isSatisfiesExpression(node) ||
        ts.isAsExpression(node) ||
        ts.isParenthesizedExpression(node)
      )
        node = node.expression
      return node
    }
    function visit(node, prefix) {
      node = unwrap(node)
      if (ts.isObjectLiteralExpression(node)) {
        for (const member of node.properties) {
          if (!ts.isPropertyAssignment(member))
            throw new Error('Unexpected current catalog property.')
          const key = member.name.text
          visit(member.initializer, `${prefix}.${key}`)
        }
      } else {
        leaves.set(
          prefix,
          ts.isStringLiteralLike(node)
            ? 'text'
            : ts.isArrowFunction(node) || ts.isFunctionExpression(node)
              ? 'function'
              : 'expression'
        )
      }
    }
    for (const statement of source.statements) {
      if (
        !ts.isVariableStatement(statement) ||
        !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
      )
        continue
      for (const declaration of statement.declarationList.declarations) {
        if (
          declaration.initializer &&
          ts.isObjectLiteralExpression(unwrap(declaration.initializer))
        )
          visit(declaration.initializer, declaration.name.text)
      }
    }
  }
  inventory.push({
    locale,
    domainFiles: files.length,
    leaves: leaves.size,
    functionLeaves: [...leaves.values()].filter((type) => type === 'function').length,
    expressionLeaves: [...leaves.values()].filter((type) => type === 'expression').length,
    keys: [...leaves.keys()].sort(),
    sourceFiles
  })
}
check('Existing four catalogs were inspected without executing their code', () =>
  assert.ok(inventory.every((item) => item.domainFiles > 0 && item.leaves > 0))
)
check('Existing function-valued messages require deliberate ICU conversion', () =>
  assert.ok(inventory.every((item) => item.functionLeaves > 0))
)
check('Existing four catalogs have the same static leaf paths', () => {
  for (const item of inventory.slice(1)) assert.deepEqual(item.keys, inventory[0].keys)
})
for (const item of inventory) delete item.keys
await writeFile(
  join(root, 'existing-catalog-inventory.json'),
  `${JSON.stringify({ sourceApplicationExecuted: false, sourceCodeExecuted: false, catalogs: inventory }, null, 2)}\n`
)
for (const fixture of fixtureHashes)
  check(`Fixture unchanged: ${fixture.path}`, () =>
    assert.equal(hash(readFileSyncForCheck(fixture.path)), fixture.sha256)
  )
function readFileSyncForCheck(path) {
  return localRequire('node:fs').readFileSync(join(root, path))
}
await writeFile(
  join(root, 'fixture-manifest.json'),
  `${JSON.stringify({ origin: 'representative-synthetic-message-catalogs', files: fixtureHashes }, null, 2)}\n`
)

const dependencies = []
for (const name of [
  'intl-messageformat',
  '@formatjs/icu-messageformat-parser',
  '@formatjs/intl-localematcher'
]) {
  const entry = dependencyRequire.resolve(name)
  let directory = dirname(entry)
  let metadata
  while (true) {
    try {
      metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    } catch {
      metadata = undefined
    }
    if (metadata?.name === name) break
    const parent = dirname(directory)
    if (parent === directory) throw new Error('Dependency package metadata not found.')
    directory = parent
  }
  const bytes = await readFile(entry)
  dependencies.push({
    name,
    version: metadata.version,
    license: metadata.license,
    entryBytes: bytes.length,
    entrySha256: hash(bytes)
  })
}
const result = {
  evidenceClass: 'actual-node-icu-and-generated-type-probe-with-lifecycle-model',
  officialTranslationsComplete: false,
  nativeHostExecuted: false,
  browserOrWebviewExecuted: false,
  runtime: { node: process.version, icu: process.versions.icu, typescript: ts.version },
  dependencies,
  representativeKeys: english.size,
  passed: checks.filter((entry) => entry.passed).length,
  failed: checks.filter((entry) => !entry.passed).length,
  checks,
  samples
}
await writeFile(join(root, 'probe-results.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(
  JSON.stringify({
    passed: result.passed,
    failed: result.failed,
    representativeKeys: english.size,
    existingCatalogs: inventory.map(({ locale, domainFiles, leaves, functionLeaves }) => ({
      locale,
      domainFiles,
      leaves,
      functionLeaves
    }))
  })
)
for (const entry of checks)
  if (!entry.passed) console.log(`FAILED: ${entry.name}: ${entry.diagnostic}`)
process.exitCode = result.failed ? 1 : 0
