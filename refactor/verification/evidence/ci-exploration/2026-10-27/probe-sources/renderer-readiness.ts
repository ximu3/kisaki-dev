import { createServer } from 'vite'
import { copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import assert from 'node:assert/strict'

const repository = 'F:/project/kisaki'
const originalApp = join(repository, 'clients/desktop/app')
const parent = await realpath(join(originalApp, '.local'))
const root = await mkdtemp(join(parent, 'renderer-readiness-'))
const app = join(root, 'clients/desktop/app')
const events: object[] = []
const started = performance.now()
const record = (event: string, details: object = {}) => {
  events.push({ elapsedMs: Math.round((performance.now() - started) * 100) / 100, event, ...details })
}
const runtime = join(app, 'config/vite/vite.config.main.ts')
const external = join(root, 'package/config/typescript/tsconfig.lib.json')
let generation = 0
let server: Awaited<ReturnType<typeof createServer>> | undefined

try {
  await mkdir(dirname(runtime), { recursive: true })
  await mkdir(dirname(external), { recursive: true })
  await copyFile(join(originalApp, 'config/vite/vite.config.renderer.ts'), join(app, 'config/vite/vite.config.renderer.ts'))
  for (const name of ['main', 'reader', 'player', 'game-panel']) {
    const directory = join(app, 'src/renderer/windows', name)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, 'index.html'), '<!doctype html><main>Watcher readiness probe</main>')
  }
  await writeFile(join(app, 'package.json'), '{"type":"module"}')
  await writeFile(runtime, 'export default {}\n')
  await writeFile(external, '{}\n')

  server = await createServer({
    configFile: join(app, 'config/vite/vite.config.renderer.ts'),
    mode: 'development',
    plugins: [{
      name: 'observe-watcher-readiness',
      configureServer(vite) {
        const current = generation++
        record('configure-server', { generation: current })
        vite.watcher.on('ready', () => record('watcher-ready', { generation: current }))
        vite.watcher.on('all', (event, path) => record('watcher-event', { generation: current, kind: event, path: relative(root, path) }))
        vite.watcher.add([runtime, dirname(external)])
      },
    }],
  })
  await server.listen()
  record('listen-returned')

  for (let restart = 0; restart < 3; restart++) {
    await server.restart()
    record('restart-returned', { restart })
    for (const [kind, path] of [['runtime', runtime], ['package', external]] as const) {
      const watched = server.watcher.getWatched()
      record('write-start', { restart, kind, presentInGetWatched: watched[dirname(path)]?.includes(basename(path)) ?? false })
      await writeFile(path, kind === 'runtime' ? `export default { attempt: ${restart} }\n` : `{"attempt":${restart}}\n`)
      record('write-finished', { restart, kind })
      await setTimeout(1_100)
    }
  }
} finally {
  await server?.close()
  record('server-closed')
  const resolved = await realpath(root)
  assert.equal(dirname(resolved), parent)
  assert.ok(basename(resolved).startsWith('renderer-readiness-'))
  await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  const report = { platform: process.platform, arch: process.arch, node: process.version, note: 'Public Vite watcher observation in an isolated fixture; not the Linux CI failure reproduction.', events }
  await writeFile(join(repository, 'refactor/verification/evidence/ci-exploration/2026-10-27/renderer-readiness-windows-x64.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
}
