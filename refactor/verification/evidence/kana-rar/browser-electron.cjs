// Serve fixed local assets and run the worker proof in a sandboxed Chromium renderer.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const [cache, output] = process.argv.slice(2)
app.setPath('userData', path.join(cache, 'browser-profile'))
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const inputs = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture-input.json'), 'utf8'))
const fixturePaths = new Map(
  inputs.fixtures.map((sample) => [sample.file, path.join(cache, 'fixtures', sample.file)])
)
const solidName = 'test_read_format_rar5_multiple_files_solid.rar'
const armName = 'test_read_format_rar5_arm.rar'
const bad = fs.readFileSync(fixturePaths.get(armName))
bad[Math.floor(bad.length / 2)] ^= 0x80
fs.writeFileSync(path.join(cache, 'corrupt-payload.rar'), bad)
fixturePaths.set('corrupt-payload.rar', path.join(cache, 'corrupt-payload.rar'))
fs.writeFileSync(path.join(cache, 'truncated.rar'), bad.subarray(0, 100))
fixturePaths.set('truncated.rar', path.join(cache, 'truncated.rar'))
fixturePaths.set('padded.rar', fixturePaths.get(solidName))
const source = (name) => ({ name, size: fs.statSync(fixturePaths.get(name)).size })
const cases = [
  { id: 'rar5-solid-all', sources: [source(solidName)], checkSynthetic: true },
  {
    id: 'rar5-solid-last-only',
    sources: [source(solidName)],
    selectedIndex: 3,
    checkSynthetic: true
  },
  { id: 'rar3-symlink-policy', sources: [source('test_read_format_rar.rar')], expectFailure: true },
  {
    id: 'rar3-unicode-symlink-policy',
    sources: [source('test_read_format_rar_unicode.rar')],
    expectFailure: true
  },
  {
    id: 'rar5-unicode-symlink-policy',
    sources: [source('test_read_format_rar5_unicode.rar')],
    expectFailure: true
  },
  ...[
    'test_read_format_rar3_lowdist_reset.rar',
    'test_read_format_rar_multi_lzss_blocks.rar',
    'test_read_format_rar5_solid.rar',
    armName,
    'test_read_format_rar5_blake2.rar'
  ].map((name) => ({ id: name, sources: [source(name)] })),
  ...[
    'test_read_format_rar4_solid_encrypted.rar',
    'test_read_format_rar4_solid_encrypted_filenames.rar',
    'test_read_format_rar5_solid_encrypted.rar',
    'test_read_format_rar5_solid_encrypted_filenames.rar'
  ].map((name) => ({ id: name, sources: [source(name)], password: 'password' })),
  {
    id: 'rar5-multiple-volumes',
    sources: [1, 2, 3, 4].map((i) =>
      source(`test_read_format_rar5_multiarchive_solid.part0${i}.rar`)
    )
  },
  {
    id: 'rar5-missing-volume',
    sources: [source('test_read_format_rar5_multiarchive_solid.part01.rar')],
    expectFailure: true
  },
  {
    id: 'missing-password',
    sources: [source('test_read_format_rar5_solid_encrypted_filenames.rar')],
    expectFailure: true
  },
  {
    id: 'wrong-password',
    sources: [source('test_read_format_rar5_solid_encrypted_filenames.rar')],
    password: 'incorrect-test-value',
    expectFailure: true
  },
  {
    id: 'memory-budget-exhausted',
    sources: [source('test_read_format_rar5_solid_encrypted.rar')],
    password: 'password',
    limitedHeap: true,
    expectFailure: true
  },
  {
    id: 'corrupt-payload',
    sources: [source('corrupt-payload.rar')],
    expectFailure: true,
    stageOutput: true
  },
  { id: 'truncated', sources: [source('truncated.rar')], expectFailure: true },
  {
    id: 'rar5-hardlink-policy',
    sources: [source('test_read_format_rar5_hardlink.rar')],
    expectFailure: true
  },
  {
    id: 'rar5-symlink-policy',
    sources: [source('test_read_format_rar5_symlink.rar')],
    expectFailure: true
  },
  {
    id: '512mib-input',
    sources: [{ name: 'padded.rar', size: 512 * 1024 * 1024 }],
    checkSynthetic: true
  },
  { id: 'cancel-pending-read', sources: [source(solidName)], cancelAt: 'read', stageOutput: true },
  {
    id: 'cancel-pending-output',
    sources: [source(armName)],
    cancelAt: 'output',
    stageOutput: true
  },
  { id: 'terminate-active-decoder', sources: [source(armName)], hardStop: true },
  { id: 'fresh-worker-after-cancel', sources: [source(solidName)], checkSynthetic: true }
]
cases.find((entry) => entry.id === 'test_read_format_rar_multi_lzss_blocks.rar').stageOutput = true
let server, win
let externalRequests = 0,
  rangeRequests = 0,
  maxResponseBytes = 0
async function main() {
  await app.whenReady()
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname.startsWith('/fixture/')) {
      const file = fixturePaths.get(decodeURIComponent(url.pathname.slice('/fixture/'.length)))
      const match = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || '')
      if (!file || !match) {
        res.writeHead(400).end()
        return
      }
      const start = Number(match[1]),
        end = Number(match[2]),
        size = Number(url.searchParams.get('size'))
      const length = end - start + 1
      if (length < 1 || length > 65536 || start < 0 || end >= size) {
        res.writeHead(416).end()
        return
      }
      rangeRequests++
      maxResponseBytes = Math.max(maxResponseBytes, length)
      const respond = () => {
        if (res.destroyed) return
        const bytes = Buffer.alloc(length)
        const descriptor = fs.openSync(file, 'r')
        try {
          fs.readSync(descriptor, bytes, 0, length, start)
        } finally {
          fs.closeSync(descriptor)
        }
        res
          .writeHead(206, {
            'Content-Type': 'application/octet-stream',
            'Content-Length': length,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Accept-Ranges': 'bytes'
          })
          .end(bytes)
      }
      if (url.searchParams.has('delay')) {
        const timer = setTimeout(respond, 500)
        res.on('close', () => clearTimeout(timer))
      } else respond()
      return
    }
    const name = url.pathname.slice(1)
    const local = ['browser-probe.html', 'browser-probe.mjs', 'decode-worker.mjs'].includes(name)
      ? path.join(__dirname, name)
      : ['build/unrar.mjs', 'build/unrar.wasm', 'limited/unrar.mjs', 'limited/unrar.wasm'].includes(
            name
          )
        ? path.join(cache, name)
        : null
    if (!local) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': name.endsWith('.wasm')
        ? 'application/wasm'
        : name.endsWith('.html')
          ? 'text/html'
          : 'text/javascript',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'"
    })
    fs.createReadStream(local).pipe(res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      partition: 'kana-rar-proof'
    }
  })
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const external = !details.url.startsWith(origin + '/')
    if (external) externalRequests++
    callback({ cancel: external })
  })
  await win.loadURL(origin + '/browser-probe.html')
  const evaluate = (code) => win.webContents.executeJavaScript(code)
  for (let i = 0; i < 100 && !(await evaluate('globalThis.probeReady === true')); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  assert(await evaluate('globalThis.probeReady === true'), 'Browser host did not initialize')
  assert(
    await evaluate('typeof process === "undefined" && typeof require === "undefined"'),
    'Node appeared in the renderer'
  )
  const crossOriginIsolated = await evaluate('globalThis.crossOriginIsolated')
  assert(!crossOriginIsolated, 'The probe unexpectedly requires cross-origin isolation')
  const receipts = []
  for (const config of cases) {
    const result = await evaluate(`runRarProbe(${JSON.stringify(config)})`)
    if (config.expectFailure)
      assert(result.failure, 'Expected rejection did not occur: ' + config.id)
    else if (config.cancelAt) assert(result.cancelled, 'Cancellation did not settle: ' + config.id)
    else if (config.hardStop) assert(result.hardTerminated, 'Termination did not complete')
    else
      assert(
        !result.failure && !result.cancelled,
        'Valid fixture failed: ' + config.id + ' ' + JSON.stringify(result.failure)
      )
    if (!config.hardStop) {
      assert(
        result.closed === 0 && result.afterClose === 15 && result.pending === 0,
        'Native close did not release the decoder'
      )
      assert(result.maximumPending <= 1, 'Worker queued multiple buffers')
      assert(
        result.openStreamsAfter === result.openStreamsBefore,
        'Native close leaked an open file'
      )
    }
    if (config.checkSynthetic)
      for (const member of result.members.filter((entry) => !entry.skipped)) {
        assert(
          inputs.solidExpectedContent[member.name]?.sha256 === member.sha256,
          'Independent synthetic content differs'
        )
      }
    if (config.password && !config.expectFailure)
      for (const member of result.members) {
        const expected = inputs.encryptedExpectedContent[member.name]
        assert(
          expected?.bytes === member.bytes && expected.crc32 === member.checksum,
          'Known encrypted plaintext differs'
        )
      }
    if (config.id === 'rar5-multiple-volumes')
      for (const member of result.members) {
        assert(
          inputs.multivolumeExpectedCrc[member.name] === member.checksum,
          'Known multivolume content differs'
        )
      }
    if (config.limitedHeap)
      assert(
        result.failure.code === 11 && result.maximumHeapBytes === 33554432,
        'Heap exhaustion did not become a native memory error'
      )
    if (config.id === 'rar3-unicode-symlink-policy')
      assert(
        result.members[1].name === '表だよ/漢字長いファイル名long-filename-in-漢字.txt',
        'RAR3 Unicode name changed'
      )
    if (config.id === 'rar5-unicode-symlink-policy')
      assert(
        result.members[0].name === '\u{1f44b}\u{1f30e}.txt',
        'RAR5 supplementary Unicode name changed'
      )
    if (config.id === '512mib-input')
      assert(result.readBytes < 65536, 'Padded input was read eagerly')
    if (config.cancelAt === 'read')
      assert(result.abortedFetches > 0, 'Pending source fetch was not aborted')
    if (config.stageOutput) {
      assert(result.stagingUsed && result.stagingRemoved, 'Private output staging was not removed')
      if (config.expectFailure || config.cancelAt)
        assert(result.publishedBytes === 0, 'Invalid partial output was published')
      else
        assert(
          result.publishedBytes === result.outputBytes &&
            result.checkedStoredBytes === result.outputBytes,
          'Stored output was not checked'
        )
    }
    if (config.id === 'corrupt-payload' || config.cancelAt === 'output')
      assert(result.stagedBytes > 0, 'Partial output cleanup was not exercised')
    receipts.push(result)
    process.stdout.write(
      JSON.stringify({
        case: config.id,
        failure: result.failure || null,
        members: result.members.length,
        outputBytes: result.outputBytes,
        heapBytes: result.maximumHeapBytes
      }) + '\n'
    )
  }
  assert(externalRequests === 0, 'Decoder requested external assets')
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        electron: process.versions.electron,
        chromium: process.versions.chrome,
        platform: process.platform,
        arch: process.arch,
        nodeInRenderer: false,
        crossOriginIsolated,
        externalRequests,
        rangeRequests,
        maxResponseBytes,
        cases: receipts,
        allAssertionsPassed: true,
        decoderExecuted: true,
        fullKanaImplementation: false,
        productionPackageConsumption: false,
        largestDecodedMemberBytes: Math.max(
          ...receipts.flatMap((result) => result.members.map((member) => member.bytes))
        ),
        broadLargeArchiveStress: false
      },
      null,
      2
    ) + '\n'
  )
  win.destroy()
  await new Promise((resolve) => server.close(resolve))
  app.quit()
}
main().catch((error) => {
  console.error(error)
  win?.destroy()
  server?.close()
  app.exit(1)
})
