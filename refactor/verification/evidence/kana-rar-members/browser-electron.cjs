// Run member resolution in hidden sandboxed Chromium workers with fixed archive sources.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const [cache, oldCache, output] = process.argv.slice(2)
app.setPath('userData', path.join(cache, 'browser-profile'))
const cases = [
  {
    name: 'rar3-symlink-unix.rar',
    requests: [
      { path: 'data_link', target: 'data.txt', text: 'data\n' },
      { path: 'data.txt', text: 'data\n' },
      { path: 'random_link', error: 'outsideArchive' }
    ],
    decodedTargets: 1
  },
  {
    name: 'rar5-symlink-unix.rar',
    requests: [
      { path: 'data_link', target: 'data.txt', text: 'data\n' },
      { path: 'data.txt', text: 'data\n' },
      { path: 'random_link', error: 'outsideArchive' }
    ],
    decodedTargets: 1
  },
  {
    name: 'rar5-symlink-win.rar',
    requests: [
      { path: 'links/file_link', target: 'content/file.txt' },
      { path: 'content/file.txt' },
      { path: 'links/dir_link', target: 'content/dir1', directory: true },
      { path: 'links/bad_link', error: 'outsideArchive' },
      { path: 'links/dir_junction', error: 'outsideArchive' }
    ],
    decodedTargets: 1
  },
  {
    name: 'rar5-hlink.rar',
    requests: ['stest1.txt', 'stest2.txt', 'stest3.txt'].map((name) => ({
      path: name,
      target: 'stest1.txt'
    })),
    decodedTargets: 1
  },
  {
    name: 'rar5-filecopy.rar',
    requests: ['stest3.txt', 'stest2.txt', 'stest1.txt'].map((name) => ({
      path: name,
      target: 'stest1.txt'
    })),
    decodedTargets: 1
  },
  {
    name: 'rar5-evil-symlink-traversal.rar',
    requests: [
      { path: 'up', error: 'outsideArchive' },
      { path: 'up/pwned.txt', error: 'outsideArchive' }
    ],
    decodedTargets: 0
  },
  {
    name: 'test_read_format_rar_unicode.rar',
    old: true,
    requests: [
      {
        path: '表だよ/ファイル',
        target: '表だよ/漢字長いファイル名long-filename-in-漢字.txt',
        text: 'kanji'
      },
      { path: '表だよ/漢字長いファイル名long-filename-in-漢字.txt', text: 'kanji' },
      { path: 'abcdefghijklmnopqrsテスト.txt' }
    ],
    decodedTargets: 2
  },
  {
    name: 'test_read_format_rar5_unicode.rar',
    old: true,
    requests: [
      { path: 'Ⓗⓐⓡⓓ Ⓛⓘⓝⓚ.txt', target: '👋🌎.txt' },
      { path: '𝒮𝓎𝓂𝒷𝑜𝓁𝒾𝒸 𝐿𝒾𝓃𝓀.txt', target: '👋🌎.txt' },
      { path: '👋🌎.txt' }
    ],
    decodedTargets: 1
  },
  {
    name: 'test_read_format_rar5_symlink.rar',
    old: true,
    requests: [{ path: 'symlink.txt', target: 'file.txt' }, { path: 'file.txt' }],
    decodedTargets: 1
  }
]
let server, win
let externalRequests = 0
async function main() {
  await app.whenReady()
  const fixturePaths = new Map(
    cases.map((item) => [item.name, path.join(item.old ? oldCache : cache, 'fixtures', item.name)])
  )
  server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1))
    if (name.startsWith('fixture/')) {
      const file = fixturePaths.get(name.slice('fixture/'.length))
      const range = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range || '')
      if (!file || !range) {
        res.writeHead(400).end()
        return
      }
      const size = fs.statSync(file).size,
        start = Number(range[1]),
        end = Number(range[2])
      if (start < 0 || end >= size || end < start || end - start + 1 > 65536) {
        res.writeHead(416).end()
        return
      }
      res.writeHead(206, {
        'Content-Length': end - start + 1,
        'Content-Range': `bytes ${start}-${end}/${size}`
      })
      fs.createReadStream(file, { start, end }).pipe(res)
      return
    }
    const file = [
      'probe.html',
      'probe-worker.mjs',
      'archive.mjs',
      'members.mjs',
      'policy-cases.mjs'
    ].includes(name)
      ? path.join(__dirname, name)
      : ['build/unrar.mjs', 'build/unrar.wasm'].includes(name)
        ? path.join(cache, name)
        : null
    if (!file) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': name.endsWith('.html')
        ? 'text/html; charset=utf-8'
        : name.endsWith('.wasm')
          ? 'application/wasm'
          : 'text/javascript'
    })
    fs.createReadStream(file).pipe(res)
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
      partition: 'kana-rar-members-proof'
    }
  })
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const external = !details.url.startsWith(origin + '/')
    if (external) externalRequests++
    callback({ cancel: external })
  })
  await win.loadURL(origin + '/probe.html')
  const runs = []
  let namespaceCases
  for (const item of cases) {
    const result = await win.webContents.executeJavaScript(
      `runCase(${JSON.stringify({ ...item, size: fs.statSync(fixturePaths.get(item.name)).size })})`
    )
    namespaceCases = result.policyCases
    delete result.policyCases
    if (result.decodedTargets !== item.decodedTargets || result.cacheAfterDispose !== 0)
      throw new Error('Reference cache behavior differs')
    const hashes = new Map()
    for (const request of result.requests)
      if (request.sha256) {
        if (hashes.has(request.target) && hashes.get(request.target) !== request.sha256)
          throw new Error('Aliases returned different content')
        hashes.set(request.target, request.sha256)
      }
    runs.push(result)
    process.stdout.write(
      JSON.stringify({
        fixture: item.name,
        requests: result.requests.length,
        decodedTargets: result.decodedTargets,
        cachedBytes: result.cachedBytes
      }) + '\n'
    )
  }
  if (externalRequests) throw new Error('Reference resolution attempted external access')
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        electron: process.versions.electron,
        chromium: process.versions.chrome,
        platform: process.platform,
        arch: process.arch,
        externalRequests,
        nodeInRenderer: await win.webContents.executeJavaScript('typeof process !== "undefined"'),
        runs,
        namespaceCases,
        allAssertionsPassed: true,
        productionReaderExecuted: false,
        fullArchiveNameValidation: false
      },
      null,
      2
    )
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
