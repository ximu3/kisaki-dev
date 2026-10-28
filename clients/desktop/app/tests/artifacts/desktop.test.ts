/**
 * @fileoverview Verifies the supplied desktop carrier, production fuses and external
 * startup and shutdown behavior.
 */

import { expect, test } from 'vitest'
import { spawn } from 'node:child_process'
import { getCurrentFuseWire, FuseState, FuseV1Options } from '@electron/fuses'
import { extractFile, listPackage } from '@electron/asar'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, isAbsolute, join, sep } from 'node:path'
import { appRoot } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import type { ArtifactReceipt } from '../../tools/package/packager'
import { sha256 } from '../../tools/lib/sha256'
import { hasNativeWindow, closeNativeWindow } from '../support/window-observation'
import { electronExecutable } from '../../tools/dev/electron-executable'
import { launchDevelopmentApplication } from '@kisaki3/extension-cli/extension'
import { prepareArtifactWorkspace } from '../support/artifact-workspace'
import type { DesktopBuild } from '../../src/shared/runtime-manifest'
import type { DistributionKind, DistributionManifest } from '../../src/shared/distribution'

/** Wait for process closure, rejecting when the supplied deadline expires. */
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
    process.env.KISAKI_ARTIFACT_RECEIPT ?? join(appRoot, 'dist', hostTarget(), 'artifacts.json')
  const receipt: ArtifactReceipt = JSON.parse(await readFile(receiptPath, 'utf8'))
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
  if (!file) throw new Error('The receipt has no movable carrier for this target')

  const workspace = await prepareArtifactWorkspace(join(dirname(receiptPath), file.path))
  const { directory, executablePath, resourceDirectory, fusePath, dataDirectory } = workspace

  try {
    const asar = join(resourceDirectory, 'app.asar')
    const build: DesktopBuild = JSON.parse(extractFile(asar, 'build.json').toString())
    const distribution: DistributionManifest = JSON.parse(
      extractFile(asar, 'distribution.json').toString(),
    )
    const carriers: Partial<Record<NodeJS.Platform, DistributionKind>> = {
      win32: 'zip',
      darwin: 'app',
      linux: 'appimage',
    }
    const expectedCarrier = carriers[process.platform]
    expect(distribution).toMatchObject({ kind: expectedCarrier, target: receipt.target })

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
    expect(entries.some((path) => /(^|\/)(tests|tools|\.local|\.cache)(\/|$)/.test(path))).toBe(
      false,
    )
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

    const child = spawn(executablePath, [], {
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

    const closed = new Promise<number | null>((resolveClose, reject) => {
      child.once('error', reject)
      child.once('close', (code) => resolveClose(code))
    })

    try {
      if (!child.pid) throw new Error('Packaged process could not start')

      await expect
        .poll(
          async ({ signal }) => {
            if (child.exitCode !== null) throw new Error(`Packaged process exited: ${diagnostic}`)

            return hasNativeWindow(child.pid!, signal)
          },
          { timeout: 30_000, interval: 250 },
        )
        .toBe(true)

      await closeNativeWindow(child.pid)
      expect(await waitForExit(closed, 15_000), diagnostic).toBe(0)
      expect((await readdir(join(dataDirectory, 'browser'))).length).toBeGreaterThan(0)
    } catch (cause) {
      throw new Error(`Packaged application verification failed:\n${diagnostic}`, { cause })
    } finally {
      if (child.exitCode === null) child.kill()
      await waitForExit(closed, 10_000)
    }

    const developmentProfile = join(directory, 'development-profile')
    const application = await launchDevelopmentApplication({
      executable: executablePath,
      cwd: directory,
      profile: developmentProfile,
      buildId: build.buildId,
      startupTimeoutMs: 30_000,
    })
    try {
      expect(application.ready).toMatchObject({ appVersion: build.version, apiVersion: null })

      // The system window list can lag behind the application's completed show request.
      await expect
        .poll(({ signal }) => hasNativeWindow(application.pid, signal), {
          timeout: 30_000,
          interval: 250,
        })
        .toBe(true)

      expect(await application.stop()).toBe('exited')
      expect(await application.exited).toEqual({ code: 0, signal: null })
      expect((await readdir(join(developmentProfile, 'browser'))).length).toBeGreaterThan(0)
    } finally {
      await application.terminate()
    }

    const missingChannelProfile = join(directory, 'missing-channel-profile')
    const rejected = spawn(
      executablePath,
      ['--development', `--profile=${missingChannelProfile}`],
      {
        cwd: directory,
        stdio: 'ignore',
        windowsHide: false,
      },
    )

    const rejectedExit = new Promise<number | null>((resolve, reject) => {
      rejected.once('error', reject)
      rejected.once('exit', resolve)
    })
    try {
      expect(await waitForExit(rejectedExit, 15_000)).not.toBe(0)
      await expect(readdir(missingChannelProfile)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      if (rejected.exitCode === null) rejected.kill()
      await waitForExit(rejectedExit, 10_000)
    }
  } finally {
    await workspace.close()
  }
})
