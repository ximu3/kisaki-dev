import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { getCurrentFuseWire } from '@electron/fuses'
import { parse } from 'yaml'

const probe = dirname(fileURLToPath(import.meta.url))
const output = join(probe, 'results')
await mkdir(output, { recursive: true })
const workspace = await mkdtemp(join(tmpdir(), 'kisaki-policy-'))
const profileName = `kisaki-policy-${process.pid}`
const policyFile = join(workspace, `${profileName}.profile`)
const installedPolicy = `/etc/apparmor.d/${profileName}`
const report: Record<string, unknown> = {
  workspace,
  policyName: profileName,
  cases: [],
  passed: false,
}
const cases = report.cases as unknown[]
const applicationConfigText = await readFile(join(probe, 'application-builder.yml'), 'utf8')
const applicationConfig = parse(applicationConfigText) as {
  appImage: { executableArgs: string[] }
  electronFuses: Record<string, boolean>
}
assert.deepEqual(applicationConfig.appImage.executableArgs, [])
report.applicationConfig = {
  sha256: createHash('sha256').update(applicationConfigText).digest('hex'),
  appImage: applicationConfig.appImage,
}
const originalSysctls = new Map<string, string>()
let policyInstalled = false

/** Execute a finite command, preserving its actual process result and diagnostics. */
async function command(
  executable: string,
  args: string[],
  allowFailure = false,
  cwd = probe,
): Promise<{ code: number | null; text: string }> {
  const child = spawn(executable, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
  let text = ''
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8').on('data', (chunk: string) => {
      text = (text + chunk).slice(-100_000)
    })
  }
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', resolve)
  })
  if (code !== 0 && !allowFailure) throw new Error(`${executable} failed (${code}): ${text}`)
  return { code, text: text.trim() }
}

/** Change a kernel condition only on this disposable CI VM, retaining its original value. */
async function setSysctl(key: string, value: string): Promise<void> {
  if (!originalSysctls.has(key))
    originalSysctls.set(key, (await command('sysctl', ['-n', key])).text)
  await command('sudo', ['-n', 'sysctl', '-w', `${key}=${value}`])
}

/** Create a real AppImage using the pinned public builder CLI and its public afterPack hook. */
async function buildImage(
  name: string,
  version: string,
  policy: 'default' | 'conditional' | 'strict',
): Promise<string> {
  console.info(`Building ${name}`)
  const appDir = join(workspace, `app-${name}`)
  const destination = join(workspace, `build-${name}`)
  await mkdir(appDir)
  await writeFile(
    join(appDir, 'main.js'),
    ts.transpileModule(await readFile(join(probe, 'main.ts'), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
    }).outputText,
  )
  await writeFile(
    join(appDir, 'package.json'),
    JSON.stringify({
      name: 'kisaki-policy-probe',
      productName: 'Kisaki Policy Probe',
      version,
      type: 'module',
      main: 'main.js',
      description: 'Synthetic sandbox policy comparison',
      author: 'Kisaki',
      license: 'MIT',
    }),
  )
  const hook = join(workspace, 'strict-launcher.cjs')
  // This fixed launcher changes no system policy and contains no sandbox fallback.
  const launcher =
    '#!/usr/bin/env bash\nset -e\nexport LD_LIBRARY_PATH="${APPDIR}/usr/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"\nexec "${APPDIR}/kisaki-policy-probe" "$@"\n'
  await writeFile(
    hook,
    `const { writeFile } = require('node:fs/promises'); const { join } = require('node:path'); module.exports = async ({ appOutDir }) => writeFile(join(appOutDir, 'AppRun'), ${JSON.stringify(launcher)}, { mode: 0o755 });\n`,
  )
  const config = {
    appId: 'me.kisaki.policy-probe',
    productName: 'Kisaki Policy Probe',
    asar: true,
    npmRebuild: false,
    electronVersion: '44.5.1',
    directories: { app: appDir, output: destination },
    files: ['!node_modules/**', 'main.js', 'package.json'],
    linux: { target: ['AppImage'], executableName: 'kisaki-policy-probe', category: 'Utility' },
    artifactName: `${name}.AppImage`,
    toolsets: { appimage: '0.0.0' },
    electronFuses: applicationConfig.electronFuses,
    ...(policy !== 'default' ? { appImage: applicationConfig.appImage } : {}),
    ...(policy === 'strict' ? { afterPack: hook } : {}),
  }
  const configPath = join(workspace, `${name}.json`)
  await writeFile(configPath, JSON.stringify(config, null, 2))
  await copyFile(configPath, join(output, `${name}-config.json`))
  const build = await command(
    'npm',
    [
      'exec',
      '--',
      'electron-builder',
      '--config',
      configPath,
      '--linux',
      'AppImage',
      '--x64',
      '--publish',
      'never',
    ],
    true,
  )
  await writeFile(join(output, `${name}-build.log`), build.text)
  assert.equal(build.code, 0, build.text)
  const image = join(destination, `${name}.AppImage`)
  const digest = createHash('sha256')
    .update(await readFile(image))
    .digest('hex')
  const fuseWire = await getCurrentFuseWire(
    join(destination, 'linux-unpacked', 'kisaki-policy-probe'),
  )
  const extracted = join(workspace, `extracted-${name}`)
  await mkdir(extracted)
  await command(image, ['--appimage-extract'], false, extracted)
  const tree = join(extracted, 'squashfs-root')
  const desktopFile = (await readdir(tree)).find((file) => file.endsWith('.desktop'))
  assert.ok(desktopFile)
  const desktop = await readFile(join(tree, desktopFile), 'utf8')
  const appRun = await readFile(join(tree, 'AppRun'), 'utf8')
  await writeFile(join(output, `${name}.desktop`), desktop)
  await writeFile(join(output, `${name}-AppRun.txt`), appRun)
  assert.equal(/--no-sandbox/.test(desktop), policy === 'default')
  assert.equal(/--no-sandbox/.test(appRun), policy !== 'strict')
  report[name] = { image, sha256: digest, fuseWire, desktop }
  return image
}

interface Ready {
  type: 'ready'
  pid: number
  uid: number
  rendererPid: number
  argv: string[]
  version: string
  isPackaged: boolean
  view: unknown
}

/** Inspect only the processes reported by this synthetic application; root is an observer, never its runtime user. */
async function inspect(pid: number): Promise<unknown> {
  const status = (await command('sudo', ['-n', 'cat', `/proc/${pid}/status`])).text
  const label = (await command('sudo', ['-n', 'cat', `/proc/${pid}/attr/current`])).text
  const namespaces: Record<string, string> = {}
  for (const name of ['user', 'pid', 'mnt', 'net']) {
    namespaces[name] = (await command('sudo', ['-n', 'readlink', `/proc/${pid}/ns/${name}`])).text
  }
  return { pid, status, label, namespaces }
}

/** Run an actual AppImage and distinguish readiness, native failure and timeout; always reap its owned process. */
async function launch(
  name: string,
  image: string,
  expected: 'sandboxed' | 'unsandboxed' | 'blocked',
  args: string[] = [],
  version = '1.0.0',
): Promise<void> {
  console.info(`Checking ${name}`)
  const profile = join(workspace, 'profiles', name)
  await mkdir(join(profile, 'browser'), { recursive: true })
  const env: NodeJS.ProcessEnv = { ...process.env, PROBE_PROFILE: profile }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(image, args, {
    cwd: workspace,
    env,
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    serialization: 'json',
  })
  let log = ''
  for (const stream of [child.stdout, child.stderr])
    stream!.setEncoding('utf8').on('data', (chunk: string) => {
      log = (log + chunk).slice(-32_000)
    })
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.once('error', reject)
      child.once('exit', (code, signal) => resolve({ code, signal }))
    },
  )
  let timer: NodeJS.Timeout | undefined
  const ready = new Promise<Ready>((resolve) =>
    child.on('message', (value: Ready) => {
      if (value.type === 'ready') resolve(value)
    }),
  )
  const event = await Promise.race([
    ready.then((value) => ({ kind: 'ready' as const, value })),
    exited.then((value) => ({ kind: 'exited' as const, value })),
    new Promise<{ kind: 'timeout' }>((resolve) => {
      timer = setTimeout(() => resolve({ kind: 'timeout' }), 25_000)
    }),
  ])
  if (timer) clearTimeout(timer)
  const result: Record<string, unknown> = { name, expected, image, event }
  cases.push(result)
  try {
    assert.notEqual(event.kind, 'timeout', `Probe timed out: ${log}`)
    if (expected === 'blocked') {
      assert.equal(event.kind, 'exited', 'Strict launch unexpectedly became ready')
      if (event.kind === 'exited') assert.notEqual(event.value.code, 0)
      return
    }
    assert.equal(event.kind, 'ready', log)
    if (event.kind !== 'ready') throw new Error('Application did not report readiness')
    assert.equal(event.value.uid, process.getuid?.())
    assert.notEqual(event.value.uid, 0)
    assert.equal(event.value.isPackaged, true)
    assert.equal(event.value.version, version)
    assert.deepEqual(event.value.view, {
      text: 'AppImage policy probe',
      node: 'undefined',
      process: 'undefined',
    })
    const main = (await inspect(event.value.pid)) as {
      status: string
      namespaces: Record<string, string>
    }
    const renderer = (await inspect(event.value.rendererPid)) as {
      status: string
      namespaces: Record<string, string>
    }
    result.main = main
    result.renderer = renderer
    assert.equal(event.value.argv.includes('--no-sandbox'), expected === 'unsandboxed')
    if (expected === 'sandboxed') {
      assert.match(renderer.status, /^Seccomp:\s+2$/m)
      assert.match(renderer.status, /^NoNewPrivs:\s+1$/m)
      assert.notEqual(renderer.namespaces.user, main.namespaces.user)
    } else {
      assert.equal(renderer.namespaces.user, main.namespaces.user)
      assert.equal(
        renderer.status.match(/^Seccomp:\s+(\d+)$/m)?.[1],
        main.status.match(/^Seccomp:\s+(\d+)$/m)?.[1],
      )
    }
    child.send({ type: 'stop' })
    const shutdownTimer = setTimeout(() => child.kill('SIGKILL'), 10_000)
    result.exit = await exited
    clearTimeout(shutdownTimer)
    assert.deepEqual(result.exit, { code: 0, signal: null })
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await exited
    if (child.connected) child.disconnect()
    child.stdout?.destroy()
    child.stderr?.destroy()
    await writeFile(join(output, `${name}.log`), log)
    await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2))
  }
}

/** Install one profile with an explicit attachment; it is removed before this disposable job ends. */
async function installProfile(attachment: string): Promise<void> {
  assert.match(attachment, /^[a-zA-Z0-9_./*\-]+$/)
  const source = `abi <abi/4.0>,\ninclude <tunables/global>\nprofile ${profileName} "${attachment}" flags=(unconfined) {\n  userns,\n}\n`
  await writeFile(policyFile, source)
  await command('sudo', ['-n', 'install', '-m', '0644', policyFile, installedPolicy])
  policyInstalled = true
  await command('sudo', ['-n', 'apparmor_parser', '--replace', installedPolicy])
  await writeFile(join(output, `profile-${cases.length}.txt`), source)
}

try {
  assert.equal(process.platform, 'linux')
  assert.notEqual(process.getuid?.(), 0)
  report.environment = {
    node: process.version,
    uid: process.getuid?.(),
    kernel: (await command('uname', ['-a'])).text,
    os: await readFile('/etc/os-release', 'utf8'),
    parentLabel: await readFile('/proc/self/attr/current', 'utf8'),
    apparmor: (await command('sudo', ['-n', 'aa-status'])).text,
  }
  const defaultImage = await buildImage('default', '1.0.0', 'default')
  const conditionalImage = await buildImage('conditional', '1.0.0', 'conditional')
  const strictV1 = await buildImage('strict-v1', '1.0.0', 'strict')
  const strictV2 = await buildImage('strict-v2', '1.0.1', 'strict')
  assert.equal(
    await readFile(join(output, 'conditional-AppRun.txt'), 'utf8'),
    await readFile(join(output, 'default-AppRun.txt'), 'utf8'),
  )
  const current = join(workspace, 'KisakiProbe.AppImage')
  await copyFile(strictV1, current)
  await chmod(current, 0o755)
  await setSysctl('kernel.apparmor_restrict_unprivileged_userns', '0')
  await launch('default-allowed', defaultImage, 'sandboxed')
  await launch('conditional-allowed', conditionalImage, 'sandboxed')
  await launch('default-desktop-argument', defaultImage, 'unsandboxed', ['--no-sandbox'])
  await setSysctl('kernel.apparmor_restrict_unprivileged_userns', '1')
  report.restrictedBaseline = await command('unshare', ['-Ur', 'true'], true)
  assert.notEqual((report.restrictedBaseline as { code: number }).code, 0)
  await launch('default-restricted', defaultImage, 'unsandboxed')
  await launch('conditional-restricted', conditionalImage, 'unsandboxed')
  await launch('strict-without-profile', current, 'blocked')
  await installProfile(current)
  await launch('strict-exact-profile', current, 'sandboxed')
  const replacement = join(workspace, 'replacement.AppImage')
  await copyFile(strictV2, replacement)
  await chmod(replacement, 0o755)
  await rename(replacement, current)
  await launch('strict-in-place-update', current, 'sandboxed', [], '1.0.1')
  const movedDirectory = join(workspace, 'moved')
  await mkdir(movedDirectory)
  const moved = join(movedDirectory, basename(current))
  await rename(current, moved)
  await launch('strict-moved-without-registration', moved, 'blocked', [], '1.0.1')
  await installProfile(moved)
  await launch('strict-moved-registered', moved, 'sandboxed', [], '1.0.1')
  await setSysctl('user.max_user_namespaces', '0')
  await launch('strict-global-userns-disabled', moved, 'blocked', [], '1.0.1')
  await launch('default-global-userns-disabled', defaultImage, 'unsandboxed')
  await launch('conditional-global-userns-disabled', conditionalImage, 'unsandboxed')
  await setSysctl('user.max_user_namespaces', originalSysctls.get('user.max_user_namespaces')!)
  const other = join(movedDirectory, 'KisakiProbe-other.AppImage')
  await copyFile('/usr/bin/unshare', other)
  await chmod(other, 0o755)
  const before = await command(other, ['-Ur', 'true'], true)
  assert.notEqual(before.code, 0)
  await installProfile(`${workspace}/**/KisakiProbe*.AppImage`)
  const after = await command(other, ['-Ur', 'true'], true)
  assert.equal(after.code, 0, after.text)
  report.wildcardAttachment = {
    before,
    after,
    meaning: 'Attachment follows a path pattern, not AppImage content or application identity.',
  }
  report.passed = true
} catch (cause) {
  report.error =
    cause instanceof Error
      ? { name: cause.name, message: cause.message, stack: cause.stack }
      : String(cause)
  process.exitCode = 1
} finally {
  const cleanup: { code: number | null; text: string }[] = []
  if (policyInstalled) {
    cleanup.push(
      await command('sudo', ['-n', 'apparmor_parser', '--remove', installedPolicy], true),
    )
    cleanup.push(await command('sudo', ['-n', 'rm', '-f', installedPolicy], true))
  }
  for (const [key, value] of originalSysctls)
    cleanup.push(await command('sudo', ['-n', 'sysctl', '-w', `${key}=${value}`], true))
  report.originalSysctls = Object.fromEntries(originalSysctls)
  report.cleanup = cleanup
  if (cleanup.some((result) => result.code !== 0)) {
    report.passed = false
    report.cleanupFailed = true
    process.exitCode = 1
  }
  report.files = await readdir(output)
  await writeFile(join(output, 'result.json'), JSON.stringify(report, null, 2))
  console.info(
    JSON.stringify({ passed: report.passed, cases: cases.length, error: report.error }, null, 2),
  )
}
