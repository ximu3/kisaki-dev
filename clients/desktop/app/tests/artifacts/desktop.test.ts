/**
 * @fileoverview Verifies the supplied desktop carrier, production fuses and external
 * startup and shutdown behavior.
 */

import { expect, onTestFailed, onTestFinished, test } from 'vite-plus/test'
import { spawn } from 'node:child_process'
import { getCurrentFuseWire, FuseState, FuseV1Options } from '@electron/fuses'
import { extractFile, listPackage } from '@electron/asar'
import { readFile, readdir, mkdir, writeFile, cp } from 'node:fs/promises'
import Database from 'better-sqlite3'
import { dirname, isAbsolute, join, sep } from 'node:path'
import { appRoot } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import type { ArtifactReceipt } from '../../tools/package/packager'
import { sha256 } from '../../tools/lib/sha256'
import { hasNativeWindow, closeNativeWindow } from '../support/window-observation'
import { electronExecutable } from '../../tools/dev/electron-executable'
import { prepareArtifactWorkspace } from './workspace'
import type { DesktopBuild } from '../../tools/build/manifest'
import type { DistributionKind, DistributionManifest } from '../../tools/package/distribution'

/**
 * Waits for process closure until the deadline and releases its timer on every outcome.
 *
 * Timeout ends the wait; process termination remains the caller's responsibility.
 */
async function waitForExit(
  closed: Promise<number | null>,
  timeoutMs: number,
): Promise<number | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      closed,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Packaged process did not exit')), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

test('the exact packaged carrier retains production fuses and starts and closes externally', async () => {
  const receiptPath =
    process.env.KISAKI_ARTIFACT_RECEIPT || join(appRoot, 'dist', hostTarget(), 'artifacts.json')
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as ArtifactReceipt
  expect(receipt.target).toBe(hostTarget())
  expect(receipt.buildId).toMatch(/\S/)
  expect(receipt.files.length).toBeGreaterThan(0)

  for (const file of receipt.files) {
    if (isAbsolute(file.path) || file.path.includes('..') || /[/\\]/.test(file.path)) {
      throw new Error('Unsafe artifact receipt path')
    }

    expect(sha256(await readFile(join(dirname(receiptPath), file.path)))).toBe(file.sha256)
  }

  const suffix = process.platform === 'linux' ? '.AppImage' : '.zip'
  const file = receipt.files.find((file) => file.path.endsWith(suffix))
  if (!file) {
    throw new Error('The receipt has no movable carrier for this target')
  }

  const workspace = await prepareArtifactWorkspace(join(dirname(receiptPath), file.path))
  const { directory, executablePath, resourceDirectory, fusePath } = workspace
  /** Cleanup handle assigned when this test owns a started packaged process. */
  let closeApplication: (() => Promise<void>) | undefined = undefined
  onTestFinished(async () => {
    // Retain the extraction when process closure cannot be confirmed.
    await closeApplication?.()
    await workspace.close()
  })

  const asar = join(resourceDirectory, 'app.asar')
  const build = JSON.parse(extractFile(asar, 'build.json').toString()) as DesktopBuild
  const distribution = JSON.parse(
    extractFile(asar, 'distribution.json').toString(),
  ) as DistributionManifest
  const carriers: Partial<Record<NodeJS.Platform, DistributionKind>> = {
    win32: 'zip',
    darwin: 'app',
    linux: 'appimage',
  }
  const expectedCarrier = carriers[process.platform]
  expect(distribution).toMatchObject({
    kind: expectedCarrier,
    target: receipt.target,
    testOnly: receipt.testOnly,
  })

  if (process.platform === 'linux') {
    const applicationDirectory = dirname(resourceDirectory)
    const desktopEntries = (await readdir(applicationDirectory)).filter((path) =>
      path.endsWith('.desktop'),
    )
    expect(desktopEntries).toHaveLength(1)

    const desktopEntry = await readFile(join(applicationDirectory, desktopEntries[0]!), 'utf8')
    expect(desktopEntry.match(/^Exec=(.*)$/m)?.[1]).toBe('AppRun %U')
  }

  expect(build).toMatchObject({
    buildId: receipt.buildId,
    version: receipt.version,
    target: receipt.target,
  })

  const entries = listPackage(asar, { isPack: false }).map((path) => path.replaceAll('\\', '/'))
  expect(entries.some((path) => /(^|\/)(tests|tools|\.local|\.cache)(\/|$)/.test(path))).toBe(false)
  expect(entries).toContain('/preload/main.cjs')
  expect(entries.some((path) => path.startsWith('/node_modules/'))).toBe(false)

  for (const [path, digest] of Object.entries(build.files)) {
    const bytes = path.startsWith('resources/')
      ? await readFile(join(resourceDirectory, path))
      : extractFile(asar, path.split('/').join(sep))
    expect(sha256(bytes), path).toBe(digest)
  }

  const fuses = await getCurrentFuseWire(fusePath)
  for (const fuse of [
    FuseV1Options.RunAsNode,
    FuseV1Options.EnableNodeOptionsEnvironmentVariable,
    FuseV1Options.EnableNodeCliInspectArguments,
    FuseV1Options.GrantFileProtocolExtraPrivileges,
  ]) {
    expect(fuses[fuse]).toBe(FuseState.DISABLE)
  }
  expect(fuses[FuseV1Options.OnlyLoadAppFromAsar]).toBe(FuseState.ENABLE)
  expect(fuses[FuseV1Options.EnableCookieEncryption]).toBe(FuseState.ENABLE)
  expect(fuses[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]).toBe(FuseState.ENABLE)

  expect((await getCurrentFuseWire(electronExecutable()))[FuseV1Options.RunAsNode]).toBe(
    FuseState.ENABLE,
  )

  // Movable production carriers adopt the test-owned portable directory by their normal marker.
  const portableDirectory = process.platform === 'win32' ? 'data' : 'kisaki-portable-data'
  const profile = join(directory, receipt.testOnly ? 'profile' : portableDirectory)
  if (!receipt.testOnly) {
    await mkdir(profile)
    await writeFile(join(directory, 'kisaki-portable.txt'), '')
  }
  /** Launches the selected artifact and records only its own process and bounded diagnostics. */
  async function launch() {
    const child = spawn(executablePath, receipt.testOnly ? [`--profile=${profile}`] : [], {
      cwd: directory,
      windowsHide: false,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let diagnostic = ''
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
      diagnostic = (diagnostic + chunk).slice(-8_192)
    })
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
      diagnostic = (diagnostic + chunk).slice(-8_192)
    })
    onTestFailed(() => {
      console.error(`Packaged application ${child.pid}:\n${diagnostic}`)
    })

    const closed = new Promise<number | null>((resolveClose, reject) => {
      child.once('error', reject)
      child.once('close', (code) => resolveClose(code))
    })
    /** Requests termination of a running fixture and waits for closure before extraction cleanup. */
    closeApplication = async () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
      }
      await waitForExit(closed, 10_000)
    }

    if (!child.pid) {
      throw new Error('Packaged process could not start')
    }

    await expect
      .poll(
        async ({ signal }) => {
          if (child.exitCode !== null) {
            throw new Error(`Packaged process exited (${child.exitCode})`)
          }

          return hasNativeWindow(child.pid!, signal)
        },
        { timeout: 30_000, interval: 250 },
      )
      .toBe(true)

    return { pid: child.pid, closed }
  }

  const first = await launch()
  await closeNativeWindow(first.pid)
  await expect.poll(() => hasNativeWindow(first.pid)).toBe(false)
  // Background residency is the default. End this isolated process before preparing its next launch.
  await closeApplication!()
  expect((await readdir(join(profile, 'browser'))).length).toBeGreaterThan(0)
  const db = new Database(join(profile, 'library.sqlite'), { fileMustExist: true })
  try {
    expect(db.prepare('select count(*) from __drizzle_migrations').pluck().get()).toBeGreaterThan(0)
    expect(db.prepare('select count(*) from preferences where id=1').pluck().get()).toBe(1)
    db.prepare(
      "update preferences set general=json_set(general,'$.closeMainWindow','quit') where id=1",
    ).run()
  } finally {
    db.close()
  }
  const second = await launch()
  await closeNativeWindow(second.pid)
  expect(await waitForExit(second.closed, 15_000)).toBe(0)
  if (receipt.testOnly) {
    // After complete exit the fixture can transfer its entire library to the movable carrier.
    const portable = join(directory, portableDirectory)
    await cp(profile, portable, { recursive: true })
    const normal = new Database(join(profile, 'library.sqlite'), { fileMustExist: true })
    try {
      normal
        .prepare(
          "update preferences set general=json_set(general,'$.closeMainWindow','background') where id=1",
        )
        .run()
    } finally {
      normal.close()
    }
    await writeFile(join(directory, 'kisaki-portable.txt'), '')
    const moved = await launch()
    await closeNativeWindow(moved.pid)
    expect(await waitForExit(moved.closed, 15_000)).toBe(0)
  }
  console.info(
    'Verified desktop carrier:',
    JSON.stringify({
      target: receipt.target,
      version: receipt.version,
      buildId: receipt.buildId,
      path: file.path,
      sha256: file.sha256,
    }),
  )
})
