// Read pinned upstream source as data; never evaluate the reader or its plugins.
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parse } from '../../../../node_modules/.pnpm/acorn@8.16.0/node_modules/acorn/dist/acorn.mjs'

const commit = '1fd0cc7f151916447d396e0c8a2c036180992cab'
const repository = 'koodo-reader/koodo-reader'
const paths = [
  'src/models/Book.ts',
  'src/models/BookLocation.ts',
  'src/models/Bookmark.ts',
  'src/models/Note.ts',
  'src/models/DictHistory.ts',
  'src/models/HtmlBook.ts',
  'src/utils/file/backup.ts',
  'src/utils/main/backup-util.js',
  'src/utils/file/export.ts',
  'src/utils/file/importData.ts',
  'src/utils/file/sqlUtil.ts',
  'src/utils/storage/databaseService.ts',
  'src/utils/file/configUtil.ts',
  'src/utils/file/bookUtil.ts',
  'src/utils/file/coverUtil.ts',
  'src/utils/file/localFile.ts',
  'src/utils/common.ts',
  'src/utils/reader/noteUtil.ts',
  'src/utils/reader/launchUtil.ts',
  'src/utils/reader/mouseEvent.ts',
  'src/containers/viewer/component.tsx',
  'src/containers/panels/progressPanel/component.tsx',
  'src/containers/panels/operationPanel/component.tsx',
  'src/components/popups/popupNote/component.tsx',
  'src/components/bookItem/useBookItem.ts',
  'src/components/bookCardItem/component.tsx',
  'src/components/dialogs/markAction/component.tsx',
  'src/components/dialogs/actionDialog/component.tsx',
  'src/components/dialogs/editDialog/component.tsx',
  'src/containers/sidebar/component.tsx',
  'src/store/actions/book.tsx',
  'src/components/importLocal/component.tsx',
  'src/pages/reader/component.tsx',
  'src/components/dialogs/annotationDialog/component.tsx',
  'src/assets/lib/kookit-extra-browser.min.js',
  'src/assets/lib/kookit-extra.min.mjs',
  'src/assets/lib/kookit.min.js',
  'preload.js',
  'package.json'
]
const sources = new Map()
const metadata = []
const inspectedPath = process.argv.find((value) => value.startsWith('--path='))?.slice(7)
const needle = process.argv.find((value) => value.startsWith('--needle='))?.slice(9)
const limit = Math.max(
  1,
  Math.min(8, Number(process.argv.find((value) => value.startsWith('--limit='))?.slice(8) || '2'))
)
const startOffset = Math.max(
  0,
  Number(process.argv.find((value) => value.startsWith('--from='))?.slice(7) || '0')
)
if (inspectedPath && !paths.includes(inspectedPath))
  throw new Error('Requested path is outside the pinned source list.')
const pendingPaths = inspectedPath ? [inspectedPath] : [...paths]
async function readSource(path) {
  const url = `https://raw.githubusercontent.com/${repository}/${commit}/${path}`
  let response
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(15000) })
      break
    } catch (cause) {
      if (attempt === 1) throw new Error(`Pinned source is unavailable: ${path}.`, { cause })
    }
  }
  if (!response.ok) throw new Error(`Pinned source request failed: ${path} (${response.status}).`)
  const text = await response.text()
  sources.set(path, text)
  metadata.push({
    path,
    url,
    status: response.status,
    checkedAt: new Date().toISOString(),
    bytes: Buffer.byteLength(text),
    sha256: createHash('sha256').update(text).digest('hex')
  })
}
await Promise.all(
  Array.from({ length: Math.min(4, pendingPaths.length) }, async () => {
    while (pendingPaths.length) await readSource(pendingPaths.shift())
  })
)

if (inspectedPath) {
  const content = sources.get(inspectedPath)
  if (!needle) console.log(content.slice(0, 20000))
  else {
    let from = startOffset
    let shown = 0
    while (shown < limit) {
      const offset = content.indexOf(needle, from)
      if (offset < 0) break
      console.log(
        JSON.stringify({ offset, text: content.slice(Math.max(0, offset - 250), offset + 2300) })
      )
      from = offset + needle.length
      shown++
    }
  }
}

if (!inspectedPath) {
  function walk(node, visit) {
    if (!node || typeof node !== 'object') return
    if (typeof node.type === 'string') visit(node)
    for (const [key, value] of Object.entries(node)) {
      if (['start', 'end', 'range', 'loc'].includes(key)) continue
      if (Array.isArray(value)) value.forEach((child) => walk(child, visit))
      else if (value && typeof value === 'object') walk(value, visit)
    }
  }
  const extraPath = 'src/assets/lib/kookit-extra-browser.min.js'
  const readerPath = 'src/assets/lib/kookit.min.js'
  const extra = parse(sources.get(extraPath), { ecmaVersion: 'latest', sourceType: 'module' })
  const reader = parse(sources.get(readerPath), { ecmaVersion: 'latest', sourceType: 'module' })
  const tables = {}
  let configKeys = []
  walk(extra, (node) => {
    if (
      node.type === 'Property' &&
      node.key?.name === 'configList' &&
      node.value?.type === 'ArrayExpression'
    ) {
      configKeys = node.value.elements.map((element) => element?.value)
    }
  })
  if (!configKeys.includes('recordLocation'))
    throw new Error('Expected pinned configuration list was not found.')
  const selectedTables = ['books', 'notes', 'bookmarks', 'words']
  walk(extra, (node) => {
    if (node.type !== 'Property' || node.key?.name !== 'createTableStatement') return
    const object = node.value?.arguments?.[0]
    if (object?.type !== 'ObjectExpression') return
    for (const property of object.properties) {
      const name = property.key.name || property.key.value
      if (!selectedTables.includes(name) || typeof property.value.value !== 'string') continue
      const ddl = property.value.value
      tables[name] = {
        sourcePath: extraPath,
        sourceOffset: property.start,
        columns: [...ddl.matchAll(/"([^"]+)"\s+(text|integer|object|array)/g)].map((m) => ({
          name: m[1],
          declaredType: m[2],
          primaryKey: m[1] === 'key'
        }))
      }
    }
  })
  if (Object.keys(tables).length !== selectedTables.length)
    throw new Error('Expected pinned table declarations were not found.')
  const methods = []
  walk(reader, (node) => {
    const name =
      node.type === 'MethodDefinition'
        ? node.key?.name
        : node.type === 'VariableDeclarator'
          ? node.id?.name
          : undefined
    if (
      !name ||
      ![
        'getPosition',
        'getPositionByChapter',
        'goToPosition',
        'getHighlightCoords',
        'createOneNote',
        'recordByChapter',
        'handleComicRecordByIndex',
        'handleRecord',
        'handleRenderChapter',
        'getAnnotationData',
        'restoreAnnotation'
      ].includes(name)
    )
      return
    const text = sources.get(readerPath).slice(node.start, node.end)
    methods.push({
      name,
      sourcePath: readerPath,
      sourceOffset: node.start,
      sourceLength: node.end - node.start,
      sha256: createHash('sha256').update(text).digest('hex')
    })
  })

  {
    const output = {
      schemaVersion: 1,
      sourceRef: 'v2.4.6',
      repository,
      commit,
      evidenceClass: 'pinned-source-static-analysis',
      sourceCodeExecuted: false,
      schemaVersionField: 'No format version inferred; inspect necessary table and column shapes.',
      tables,
      declaredConfigKeys: configKeys,
      readerMethods: methods,
      sources: metadata.sort((a, b) => a.path.localeCompare(b.path))
    }
    await writeFile(
      fileURLToPath(new URL('./source-contract.json', import.meta.url)),
      JSON.stringify(output, null, 2) + '\n'
    )
    console.log(
      JSON.stringify({
        sourceFiles: metadata.length,
        tables: Object.keys(tables),
        readerMethods: methods.length
      })
    )
  }
}
