// Inspect both original branches without Foliate's display conversion or automatic KF8 preference.
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const [cache, output] = process.argv.slice(2)
const { MOBI, getIndexData, concatTypedArray3 } = await import(
  pathToFileURL(path.join(cache, 'foliate-raw.mjs'))
)
const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex')
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const runs = []
for (const name of (await readdir(path.join(cache, 'mobi'))).filter((name) =>
  name.endsWith('.mobi')
)) {
  const bytes = await readFile(path.join(cache, 'mobi', name))
  const count = bytes.readUInt16BE(76)
  const offsets = Array.from({ length: count }, (_, index) => bytes.readUInt32BE(78 + index * 8))
  const starts = offsets.flatMap((offset, index) =>
    bytes.subarray(offset + 16, offset + 20).toString() === 'MOBI' ? [index] : []
  )
  const branches = []
  for (const start of starts) {
    const source = await new MOBI({}).openRawForProof(new File([bytes], name), start)
    assert(source.headers.palmdoc.encryption === 0, 'The proof requires an unencrypted sample')
    const rawParts = []
    for (let index = 0; index < source.headers.palmdoc.numTextRecords; index++)
      rawParts.push(await source.loadText(index))
    const raw = Buffer.concat(rawParts)
    const branch = {
      record: start,
      version: source.headers.mobi.version,
      compression: source.headers.palmdoc.compression,
      encoding: source.headers.mobi.encoding,
      textRecords: rawParts.length,
      recordByteLengths: rawParts.map((item) => item.length),
      rawBytes: raw.length,
      rawSha256: hash(raw),
      rawMd5: hash(raw, 'md5'),
      trailingFlags: source.headers.mobi.trailingFlags,
      declaredTextBytes: bytes.readUInt32BE(offsets[start] + 4),
      comboBoundary: source.headers.exth?.boundary ?? null,
      fixedLayout: source.headers.exth?.fixedLayout ?? null,
      originalResolution: source.headers.exth?.originalResolution ?? null
    }
    assert(
      branch.rawBytes === branch.declaredTextBytes,
      'Decompressed stream length differs from PalmDOC'
    )
    await writeFile(path.join(cache, 'mobi', `${name}.${start}.raw`), raw)
    if (source.headers.kf8) {
      const loadRecord = source.loadRecord.bind(source)
      const skels = (await getIndexData(source.headers.kf8.skel, loadRecord)).table.map(
        ({ name, tagMap }, index) => ({
          index,
          name,
          numFrag: tagMap[1][0],
          offset: tagMap[6][0],
          length: tagMap[6][1]
        })
      )
      const fragmentData = await getIndexData(source.headers.kf8.frag, loadRecord)
      const fragments = fragmentData.table.map(({ name, tagMap }) => ({
        insertOffset: Number(name),
        index: tagMap[4][0],
        offset: tagMap[6][0],
        length: tagMap[6][1]
      }))
      let fragmentStart = 0
      branch.documents = []
      for (const skel of skels) {
        const selected = fragments.slice(fragmentStart, fragmentStart + skel.numFrag)
        fragmentStart += skel.numFrag
        let document = raw.subarray(skel.offset, skel.offset + skel.length)
        const pieces = [{ sourceStart: skel.offset, sourceEnd: skel.offset + skel.length }]
        for (const fragment of selected) {
          const insertion = fragment.insertOffset - skel.offset
          const sourceStart = skel.offset + skel.length + fragment.offset
          const sourceEnd = sourceStart + fragment.length
          assert(
            Number.isSafeInteger(insertion) &&
              insertion >= 0 &&
              insertion <= document.length &&
              sourceEnd <= raw.length,
            'Invalid KF8 reconstruction bounds'
          )
          document = concatTypedArray3(
            document.subarray(0, insertion),
            raw.subarray(sourceStart, sourceEnd),
            document.subarray(insertion)
          )
          pieces.push({ sourceStart, sourceEnd, insertion })
        }
        const filename = `${name}.${start}.${skel.index}.html`
        await writeFile(path.join(cache, 'mobi', filename), document)
        branch.documents.push({
          documentIndex: skel.index,
          rawFile: filename,
          bytes: document.length,
          sha256: hash(document),
          skeleton: skel,
          fragments: selected,
          pieces
        })
      }
      assert(fragmentStart === fragments.length, 'Fragments remain outside the skeleton table')
    }
    branches.push(branch)
  }
  const expectedFile = path.join(cache, 'libmobi/tests/md5', `${hash(bytes, 'md5')}_rawml.md5`)
  const expected = (await readFile(expectedFile, 'utf8')).trim().split(/\s/)[0]
  assert(
    branches.at(-1).rawMd5 === expected,
    `Independent libmobi raw expectation differs: ${name}`
  )
  runs.push({
    name,
    sourceSha256: hash(bytes),
    branches,
    independentRawMd5: expected,
    independentRawMatched: true
  })
}
const oldHuff = runs.find((run) => run.name === 'sample-unicode-huffdic.mobi').branches[0]
const oldPlain = runs.find((run) => run.name === 'sample-unicode-uncompressed.mobi').branches[0]
assert(oldHuff.rawSha256 === oldPlain.rawSha256, 'HUFF/CDIC and uncompressed copies disagree')
await writeFile(
  output,
  JSON.stringify(
    {
      runs,
      oldBranchCompressionCrossCheck: true,
      fullReaderExecuted: false,
      independentRawDecoderExecuted: false,
      independentExpectedHashesUsed: true,
      displayMarkupRewritten: false
    },
    null,
    2
  ) + '\n'
)
process.stdout.write(
  JSON.stringify({
    samples: runs.length,
    branches: runs.reduce((sum, item) => sum + item.branches.length, 0),
    reconstructedDocuments: runs
      .flatMap((run) => run.branches)
      .reduce((sum, item) => sum + (item.documents?.length ?? 0), 0)
  }) + '\n'
)
