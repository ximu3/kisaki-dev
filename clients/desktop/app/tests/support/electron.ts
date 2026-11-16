/**
 * @fileoverview Provides Playwright fixtures that own a prepared desktop launch and its
 * isolated profile.
 */

import { _electron, test as base } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import electronManifest from 'electron/package.json' with { type: 'json' }
import { buildDirectory } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import { electronExecutable } from '../../tools/dev/electron-executable'

/** Engineering fixture renderer and preload entry selected for a desktop test. */
type WindowKind = 'main' | 'reader' | 'player' | 'game-panel'

/** A completed desktop build launched with a profile owned by this test. */
interface DesktopFixtures {
  desktop: ElectronApplication
  profile: string
  kind: WindowKind
}

/** Playwright fixtures that own the prepared Electron process and its isolated profile. */
export const test = base.extend<DesktopFixtures>({
  kind: ['main', { option: true }],

  /** Owns an isolated profile for the consuming test and removes it after teardown. */
  profile: async ({}, use) => {
    const directory = await mkdtemp(join(tmpdir(), 'kisaki-desktop-test-'))
    try {
      await use(directory)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },

  /** Launches the verified host build and closes its actual Electron process after the test. */
  desktop: async ({ profile, kind }, use, info) => {
    const runtime = buildDirectory(hostTarget())
    const build = JSON.parse(await readFile(join(runtime, 'build.json'), 'utf8')) as {
      target: string
      electronVersion: string
    }
    if (build.target !== hostTarget() || build.electronVersion !== electronManifest.version) {
      throw new Error('The test input does not match the selected Electron target')
    }

    const env: Record<string, string> = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    )
    delete env.ELECTRON_RUN_AS_NODE
    if (process.platform === 'linux') {
      env.XDG_CONFIG_HOME = join(profile, 'xdg/config')
      env.XDG_DATA_HOME = join(profile, 'xdg/data')
    }

    const application = await _electron.launch({
      chromiumSandbox: true,
      executablePath: electronExecutable(),
      args: [join(runtime, 'main/entry.js'), `--profile=${profile}`, `--window=${kind}`],
      env,
    })
    const child = application.process()
    const stopped = once(child, 'close')
    void stopped.catch(() => {})

    try {
      await use(application)
    } finally {
      const passed = info.status === info.expectedStatus
      const deadline = setTimeout(
        () => {
          if (child.exitCode === null && child.signalCode === null) {
            child.kill('SIGKILL')
          }
        },
        passed ? 15_000 : 5_000,
      )
      try {
        if (child.exitCode === null && child.signalCode === null) {
          await application.close()
        }
        await stopped
      } finally {
        clearTimeout(deadline)
      }
    }
    if (info.status === info.expectedStatus && child.exitCode !== 0) {
      await info.attach('runtime-log', { path: join(profile, 'logs', 'runtime.log') })
      throw new Error(
        `Desktop application failed to exit normally (${child.signalCode ?? child.exitCode})`,
      )
    }
  },
})

export { expect } from '@playwright/test'
