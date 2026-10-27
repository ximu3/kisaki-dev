import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parse } from 'yaml'
import { run } from '@kisaki3/tooling/process'

const evidence = dirname(fileURLToPath(import.meta.url))
const root = resolve(evidence, '../../../../..')
const appRoot = join(root, 'clients/desktop/app')
const requireApp = createRequire(join(appRoot, 'package.json'))
const electronExecutable: string = requireApp('electron')
const { getCurrentFuseWire, FuseState, FuseV1Options } = requireApp('@electron/fuses')
const { extractFile } = requireApp('@electron/asar')
const electronVersion: string = requireApp('electron/package.json').version
const builderVersion: string = requireApp('electron-builder/package.json').version
const builderCli = resolve(dirname(requireApp.resolve('electron-builder/package.json')), requireApp('electron-builder/package.json').bin['electron-builder'])
const production = parse(await readFile(join(appRoot, 'electron-builder.yml'), 'utf8'))
const parent = join(root, '.cache/development-ipc')
await mkdir(parent, { recursive: true })
const reuse = process.argv[2]
const work = reuse ? resolve(reuse) : await mkdtemp(join(parent, 'packaged-'))
assert.equal(dirname(work), parent)
const application = join(work, 'app')
await mkdir(application, { recursive: true })

const source = await readFile(join(evidence, 'main.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
}).outputText
await writeFile(join(application, 'main.js'), compiled)
await writeFile(join(application, 'package.json'), JSON.stringify({
  name: 'kisaki-development-ipc-probe', version: '0.0.0', private: true,
  type: 'module', main: 'main.js', description: 'Packaged Electron parent-child IPC probe',
  author: 'Kisaki', license: 'MIT',
}, null, 2))
const builderConfig = {
  extends: null,
  appId: 'me.kisaki.development-ipc-probe',
  productName: 'Kisaki Development IPC Probe',
  electronVersion,
  electronDist: dirname(electronExecutable),
  asar: true,
  npmRebuild: false,
  files: ['!node_modules/**', 'main.js', 'package.json'],
  electronFuses: production.electronFuses,
  directories: { app: application, output: join(work, 'output'), buildResources: application },
  win: { executableName: 'Kisaki-Ipc-Probe', signAndEditExecutable: true },
  publish: null,
}
const config = join(work, 'electron-builder.json')
await writeFile(config, JSON.stringify(builderConfig, null, 2))
assert.equal(process.platform, 'win32', 'This recorded carrier probe targets Windows x64')
if (!reuse) {
  await run(process.execPath, [builderCli, '--config', config, '--win', '--x64', '--dir', '--publish', 'never'], {
    cwd: appRoot,
    env: { CSC_IDENTITY_AUTO_DISCOVERY: 'false', CSC_LINK: undefined, CSC_KEY_PASSWORD: undefined, WIN_CSC_LINK: undefined, WIN_CSC_KEY_PASSWORD: undefined },
  })
}
const executable = join(work, 'output/win-unpacked/Kisaki-Ipc-Probe.exe')
const asar = join(work, 'output/win-unpacked/resources/app.asar')
assert.equal(extractFile(asar, 'main.js').toString(), compiled)
const fuses = await getCurrentFuseWire(executable)
for (const fuse of [FuseV1Options.RunAsNode, FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseV1Options.EnableNodeCliInspectArguments, FuseV1Options.GrantFileProtocolExtraPrivileges]) {
  assert.equal(fuses[fuse], FuseState.DISABLE)
}
for (const fuse of [FuseV1Options.EnableCookieEncryption, FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseV1Options.OnlyLoadAppFromAsar]) {
  assert.equal(fuses[fuse], FuseState.ENABLE)
}

/** Exercise only message transport and the application lifetime, using an isolated profile. */
async function probe(disconnect: boolean): Promise<Record<string, unknown>> {
  const profile = join(work, disconnect ? 'disconnect-profile' : 'normal-profile')
  const env = { ...process.env, KISAKI_IPC_PROBE_PROFILE: profile }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.NODE_OPTIONS
  const child = spawn(executable, [], { cwd: work, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], serialization: 'json' })
  const messages: { type: string; id?: number; value?: unknown; runtime?: Record<string, unknown>; outcome?: string }[] = []
  let exited = false
  let diagnostics = ''
  const ended = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    child.once('exit', (code, signal) => { exited = true; resolve({ code, signal }) })
  })
  const deadline = new AbortController()
  const timer = setTimeout(() => {
    deadline.abort(new Error('The packaged IPC probe did not finish within 15 seconds'))
    if (!exited) child.kill()
  }, 15_000)
  child.on('message', (value) => messages.push(value as typeof messages[number]))
  child.stdout?.on('data', (value) => { diagnostics = (diagnostics + value).slice(-16384) })
  child.stderr?.on('data', (value) => { diagnostics = (diagnostics + value).slice(-16384) })

  /** Wait for the exact reply; a deadline detects a failed transport without timing readiness. */
  async function receive(type: string, id?: number): Promise<typeof messages[number]> {
    while (true) {
      const found = messages.find(message => message.type === type && message.id === id)
      if (found) return found
      if (exited) throw new Error('The application exited before the expected reply')
      await once(child, 'message', { signal: deadline.signal })
    }
  }

  try {
    const ready = await receive('ready')
    assert.equal(ready.runtime?.packaged, true)
    assert.equal(ready.runtime?.processType, 'browser')
    assert.equal(ready.runtime?.connected, true)
    if (disconnect) {
      child.disconnect()
    } else {
      const value = { rootPath: 'F:/Synthetic/日本語 与中文/extension', webviews: [], enabled: false, count: 0 }
      child.send({ type: 'echo', id: 1, value })
      assert.deepEqual((await receive('echoResult', 1)).value, value)
      child.send({ type: 'cancelStop', id: 2 })
      assert.equal((await receive('stopResult', 2)).outcome, 'cancelled')
      child.send({ type: 'echo', id: 3, value: 'alive after cancelled quit' })
      assert.equal((await receive('echoResult', 3)).value, 'alive after cancelled quit')
      child.send({ type: 'stop', id: 4 })
      assert.equal((await receive('stopResult', 4)).outcome, 'exiting')
    }
    const exit = await ended
    deadline.signal.throwIfAborted()
    assert.equal(exit.code, 0)
    const observed = disconnect ? JSON.parse(await readFile(join(profile, 'disconnect.json'), 'utf8')) : undefined
    return { runtime: ready.runtime, messages, exit, disconnect: observed, diagnostics }
  } finally {
    clearTimeout(timer)
    if (!exited) { child.kill(); await ended }
    child.stdout?.destroy()
    child.stderr?.destroy()
  }
}

const result: Record<string, unknown> = { electronVersion, builderVersion, parentNode: process.version, platform: process.platform, architecture: process.arch, work, fuses, scenarios: [] }
try {
  const scenarios = result.scenarios as Record<string, unknown>[]
  scenarios.push({ name: 'roundtrip-cancelled-quit-and-normal-exit', ...await probe(false) })
  scenarios.push({ name: 'channel-disconnect-and-normal-exit', ...await probe(true) })
  result.passed = true
} catch (error) {
  result.passed = false
  result.failure = String(error)
  process.exitCode = 1
} finally {
  result.executableSha256 = createHash('sha256').update(await readFile(executable)).digest('hex')
  result.asarSha256 = createHash('sha256').update(await readFile(asar)).digest('hex')
  await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
}
