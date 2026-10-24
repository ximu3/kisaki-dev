// Capture the controlled view in the real Electron compositor; no book Node bridge is exposed.
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const [cache, output, deviceScale] = process.argv.slice(2)
app.commandLine.appendSwitch('force-device-scale-factor', deviceScale)
app.setPath('userData', path.join(cache, `profile-${deviceScale}`))
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
let server, win
async function main() {
  await app.whenReady()
  server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname
    const file =
      name === '/casefold.json'
        ? path.join(cache, 'casefold.json')
        : ['/content-probe.html', '/content-probe.mjs'].includes(name)
          ? path.join(__dirname, name.slice(1))
          : null
    if (!file) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': name.endsWith('.html')
        ? 'text/html; charset=utf-8'
        : name.endsWith('.json')
          ? 'application/json'
          : 'text/javascript'
    })
    fs.createReadStream(file).pipe(res)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  win = new BrowserWindow({
    width: 1000,
    height: 820,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      partition: 'kana-content-proof'
    }
  })
  await win.loadURL(`http://127.0.0.1:${server.address().port}/content-probe.html`)
  const evaluate = (code) => win.webContents.executeJavaScript(code)
  for (let i = 0; i < 100; i++) {
    if (await evaluate('globalThis.probeReady === true')) break
    await new Promise((resolve) => setTimeout(resolve, 30))
  }
  assert(await evaluate('globalThis.probeReady === true'), 'Content probe did not initialize')
  const cases = []
  for (const zoom of [1, 1.25]) {
    win.webContents.setZoomFactor(zoom)
    for (const rotation of [0, 90, 180, 270]) {
      const geometry = await evaluate(`probe.configure(${rotation}, 1.25)`)
      const view = await evaluate('probe.beginRead()')
      await evaluate('probe.navigate(); true')
      const waiting = await evaluate('probe.status()')
      assert(
        waiting.sourcePage === 'a.svg' && !waiting.navigationCompleted,
        'Navigation changed the pinned view'
      )
      // The conversion is exercised, not assumed, by pixel checks below.
      const left = Math.floor(view.rect.left * zoom),
        top = Math.floor(view.rect.top * zoom)
      const right = Math.ceil((view.rect.left + view.rect.width) * zoom)
      const bottom = Math.ceil((view.rect.top + view.rect.height) * zoom)
      const captureRect = { x: left, y: top, width: right - left, height: bottom - top }
      const image = await win.webContents.capturePage(captureRect, { stayHidden: true })
      assert(!image.isEmpty(), 'Capture returned an empty image')
      const scaleFactors = image.getScaleFactors()
      const representation = Math.max(...scaleFactors)
      const png = image.toPNG({ scaleFactor: representation })
      const width = png.readUInt32BE(16),
        height = png.readUInt32BE(20)
      const bitmap = image.toBitmap({ scaleFactor: representation })
      assert(
        bitmap.length === width * height * 4,
        'Bitmap dimensions disagree with its representation'
      )
      assert(
        Math.abs(width - view.rect.width * view.dpr) <= 3 &&
          Math.abs(height - view.rect.height * view.dpr) <= 3,
        'CSS and raster sizes disagree beyond outward rounding'
      )
      const center = (Math.floor(height / 2) * width + Math.floor(width / 2)) * 4
      const color = [...bitmap.subarray(center, center + 4)]
      assert(
        Math.abs(color[0] - 40) <= 3 &&
          Math.abs(color[1] - 40) <= 3 &&
          Math.abs(color[2] - 198) <= 3,
        `Capture missed the source region: ${JSON.stringify({ zoom, rotation, color, captureRect })}`
      )
      let regionSamples = 0
      for (const x of [0.15, 0.325, 0.5, 0.675, 0.85])
        for (const y of [0.15, 0.325, 0.5, 0.675, 0.85]) {
          const offset = (Math.floor(height * y) * width + Math.floor(width * x)) * 4
          assert(
            Math.abs(bitmap[offset] - 40) <= 3 &&
              Math.abs(bitmap[offset + 1] - 40) <= 3 &&
              Math.abs(bitmap[offset + 2] - 198) <= 3,
            'Captured pixels lie outside the selected source region'
          )
          regionSamples++
        }
      const end = await evaluate('probe.finishRead()')
      assert(
        end.accepted && end.sourcePage === 'b.svg' && end.navigationCompleted,
        'Pinned read did not finish before queued navigation'
      )
      cases.push({
        zoom,
        rotation,
        geometry,
        view,
        captureRect,
        scaleFactors,
        representation,
        width,
        height,
        centerBgra: color,
        regionSamples,
        end
      })
    }
  }
  await evaluate('probe.configure(0, 1.25)')
  let outsideRejected = false
  try {
    await evaluate('probe.beginRead("outside")')
  } catch {
    outsideRejected = true
  }
  assert(outsideRejected, 'An off-crop source region was accepted')
  const wholeView = await evaluate('probe.beginRead("viewport")')
  const wholeRect = {
    x: Math.floor(wholeView.rect.left * 1.25),
    y: Math.floor(wholeView.rect.top * 1.25),
    width: Math.ceil(wholeView.rect.width * 1.25),
    height: Math.ceil(wholeView.rect.height * 1.25)
  }
  const wholeImage = await win.webContents.capturePage(wholeRect, { stayHidden: true })
  const wholePixels = wholeImage.toBitmap({
    scaleFactor: Math.max(...wholeImage.getScaleFactors())
  })
  let overlayPixels = 0
  for (let i = 0; i < wholePixels.length; i += 4) {
    if (wholePixels[i] === 255 && wholePixels[i + 1] === 0 && wholePixels[i + 2] === 255)
      overlayPixels++
  }
  assert(overlayPixels === 0, 'Reader overlay or toolbar entered the viewport capture')
  assert((await evaluate('probe.finishRead()')).accepted, 'Whole-view read did not complete')
  await evaluate('probe.beginRead("viewport")')
  const [width, height] = win.getContentSize()
  win.setContentSize(width - 20, height)
  const resize = await evaluate('probe.finishRead()')
  assert(
    !resize.accepted && resize.cause === 'viewChanged',
    'Resize did not invalidate the view read'
  )
  await evaluate('probe.configure(0, 1.25)')
  await evaluate('probe.beginRead()')
  await evaluate('probe.startClose(); true')
  const closeBeforeFinish = await evaluate('globalThis.closeResolved === true')
  assert(!closeBeforeFinish, 'Close completed before the view callback was settled')
  const closing = await evaluate('probe.finishRead()')
  assert(
    !closing.accepted && closing.cause === 'closed' && closing.closed,
    'Close did not reject the stale read'
  )
  const text = await evaluate('globalThis.textResult')
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        electron: process.versions.electron,
        chromium: process.versions.chrome,
        platform: process.platform,
        arch: process.arch,
        deviceScale: Number(deviceScale),
        cases,
        outsideRejected,
        wholeViewport: { rect: wholeRect, overlayPixels },
        resize,
        closeBeforeFinish,
        closing,
        text,
        kanaReaderExecuted: false,
        allGeometryAndTextCasesCovered: false
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
