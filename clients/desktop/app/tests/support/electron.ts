import { _electron, test as base, type ElectronApplication } from '@playwright/test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import electronManifest from 'electron/package.json' with { type: 'json' }
import { buildDirectory } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import { electronExecutable } from '../../tools/dev/electron-executable'

type WindowKind = 'main' | 'reader' | 'player' | 'game-panel'

interface DesktopFixtures {
  desktop: ElectronApplication
  profile: string
  kind: WindowKind
}

export async function launchBuiltDesktop(
  runtime: string,
  profile: string,
  kind: WindowKind = 'main',
) {
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

  return _electron.launch({
    chromiumSandbox: true,
    executablePath: electronExecutable(),
    args: [join(runtime, 'main/entry.js'), `--profile=${profile}`, `--window=${kind}`],
    env,
  })
}

export const test = base.extend<DesktopFixtures>({
  kind: ['main', { option: true }],

  profile: async ({}, use) => {
    const directory = await mkdtemp(join(tmpdir(), 'kisaki-desktop-test-'))
    try {
      await use(directory)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },

  desktop: async ({ profile, kind }, use, info) => {
    const application = await launchBuiltDesktop(buildDirectory(hostTarget()), profile, kind)
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
