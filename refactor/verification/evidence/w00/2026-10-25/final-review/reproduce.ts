import { fork } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, stat, writeFile, copyFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const root = process.cwd()
const owned = resolve('.cache/w00-final-review/2026-10-25')
await mkdir(owned, { recursive: true })
const { replaceOutput } = await import(
  pathToFileURL(join(root, 'clients/desktop/app/tools/lib/output.ts')).href
)

if (process.argv[2] === 'lock-child') {
  const output = resolve(process.argv[3]!)
  assert.ok(output.startsWith(owned + sep))
  await replaceOutput(output, async (staging: string) => {
    await writeFile(join(staging, 'partial.txt'), 'unpublished candidate')
    process.send?.({ type: 'prepared', staging })
    await new Promise(() => undefined)
  })
} else {
  const runDirectory = await mkdtemp(join(owned, 'repro-'))
  const output = join(runDirectory, 'interrupted-output', 'runtime')
  await mkdir(output, { recursive: true })
  await writeFile(join(output, 'previous.txt'), 'last complete output')
  const child = fork(fileURLToPath(import.meta.url), ['lock-child', output], {
    cwd: root,
    execArgv: process.execArgv,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  })
  let childError = ''
  child.stderr?.on('data', (data) => { childError += data.toString() })
  await new Promise<void>((done, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Child preparation timed out: ${childError}`)), 15000)
    child.once('error', (error) => { clearTimeout(timeout); reject(error) })
    child.once('message', () => { clearTimeout(timeout); done() })
  })
  const closed = new Promise<{ code: number | null; signal: string | null }>((done) => {
    child.once('close', (code, signal) => done({ code, signal }))
  })
  child.kill('SIGTERM')
  const termination = await closed
  const lockRemainsAfterProcessExit = await stat(`${output}.lock`).then(() => true, () => false)
  const previousOutput = await readFile(join(output, 'previous.txt'), 'utf8')
  let retryError: { code?: string; message: string } | undefined
  try {
    await replaceOutput(output, async (staging: string) => {
      await writeFile(join(staging, 'new.txt'), 'new complete output')
    })
  } catch (cause) {
    const error = cause as NodeJS.ErrnoException
    retryError = { code: error.code, message: error.message }
  }
  const lock = {
    childPid: child.pid,
    termination,
    lockRemainsAfterProcessExit,
    previousOutput,
    retryError,
    retryPublishedOutput: await readFile(join(output, 'new.txt'), 'utf8').then(
      (value) => value === 'new complete output',
      () => false,
    ),
  }

  const workspace = join(runDirectory, 'identity-workspace')
  const app = join(workspace, 'clients/desktop/app')
  for (const directory of ['src', 'native', 'tools/build', 'tools/lib', 'assets', 'config']) {
    await mkdir(join(app, directory), { recursive: true })
  }
  const copied: { file: string; sha256: string }[] = []
  for (const file of ['tools/build/identity.ts', 'tools/lib/paths.ts', 'tools/lib/sha256.ts']) {
    const source = join(root, 'clients/desktop/app', file)
    const target = join(app, file)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(source, target)
    const original = await readFile(source)
    assert.deepEqual(await readFile(target), original)
    copied.push({ file, sha256: createHash('sha256').update(original).digest('hex') })
  }
  for (const file of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json']) {
    await writeFile(join(workspace, file), '{}\n')
  }
  const pkg = join(workspace, 'clients/desktop/packages/ui')
  for (const directory of ['src', 'tools', 'config/typescript']) {
    await mkdir(join(pkg, directory), { recursive: true })
  }
  await writeFile(join(workspace, 'package.json'), '{"type":"module"}\n')
  await writeFile(join(app, 'package.json'), '{"name":"audit-app"}\n')
  await writeFile(join(pkg, 'package.json'), '{"name":"audit-ui"}\n')
  await writeFile(join(pkg, 'src/index.ts'), 'export const value = 1\n')
  await writeFile(join(pkg, 'tsconfig.json'), '{"files":[],"references":[{"path":"./config/typescript/tsconfig.lib.json"}]}\n')
  const buildConfig = join(pkg, 'tsdown.config.ts')
  await writeFile(buildConfig, "export default { tsconfig: './config/typescript/tsconfig.lib.json' }\n")
  const nestedConfig = join(pkg, 'config/typescript/tsconfig.lib.json')
  await writeFile(nestedConfig, '{"compilerOptions":{"target":"ES2023"}}\n')
  const { sourceIdentity } = await import(pathToFileURL(join(app, 'tools/build/identity.ts')).href)
  const before = await sourceIdentity()
  await writeFile(nestedConfig, '{"compilerOptions":{"target":"ES2022"}}\n')
  const afterNestedConfigChange = await sourceIdentity()
  await writeFile(buildConfig, "export default { tsconfig: './config/typescript/tsconfig.lib.json' } // control\n")
  const afterRootConfigChange = await sourceIdentity()
  const identity = {
    copiedSource: copied,
    before,
    afterNestedConfigChange,
    afterRootConfigChange,
    nestedConfigurationDetected: before !== afterNestedConfigChange,
    rootConfigurationDetected: afterNestedConfigChange !== afterRootConfigChange,
  }
  const result = { runDirectory, lock, identity }
  await writeFile(join(owned, 'reproductions.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
}
