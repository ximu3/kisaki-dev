// Consume only installed tarballs in a separate process and working directory.
const fs = require('node:fs')
const path = require('node:path')
const electron = process.versions.electron ? require('electron') : null
const deadline = setTimeout(() => {
  if (electron) electron.app.exit(2)
  else process.exit(2)
}, 30000)

async function run() {
  const result = await require('@libmpv-design/loader-probe').runFixture()
  fs.writeFileSync(
    path.join(__dirname, process.versions.electron ? 'electron.json' : 'node.json'),
    JSON.stringify(
      {
        node: process.versions.node,
        electron: process.versions.electron || null,
        operatingSystem: process.platform,
        architecture: process.arch,
        path: process.env.PATH,
        cwd: process.cwd(),
        ...result,
        frameResourcesReleased: true
      },
      null,
      2
    ) + '\n'
  )
  clearTimeout(deadline)
  if (electron) electron.app.quit()
}

if (electron) electron.app.setPath('userData', path.join(__dirname, 'electron data'))
Promise.resolve(electron ? electron.app.whenReady() : undefined)
  .then(run)
  .catch((error) => {
    console.error(error)
    clearTimeout(deadline)
    if (electron) electron.app.exit(1)
    else process.exitCode = 1
  })
