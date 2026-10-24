import { _electron, test as base } from '@playwright/test'
import type { ElectronApplication } from '@playwright/test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDirectory } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import { electronExecutable } from '../../tools/dev/electron-executable'
import type { WindowKind } from '../../src/shared/window-controls'

/** A completed desktop build launched with a profile owned by this test. */
interface DesktopFixtures {
  desktop: ElectronApplication
  profile: string
  kind: WindowKind
}

export const test = base.extend<DesktopFixtures>({
  kind: ['main', { option: true }],
  profile: async ({}, use) => {
    const directory = await mkdtemp(join(tmpdir(), 'kisaki-e2e-'))
    try {
      await use(directory)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
  desktop: async ({ profile, kind }, use) => {
    const runtime = buildDirectory(hostTarget())
    const build: { target: string; electronVersion: string } = JSON.parse(
      await readFile(join(runtime, 'build.json'), 'utf8'),
    )
    if (build.target !== hostTarget() || build.electronVersion !== '44.5.1') {
      throw new Error('The test input does not match the selected Electron target')
    }

    const env: Record<string, string> = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    )
    env.KISAKI_DEV_PROFILE = profile
    env.KISAKI_WINDOW = kind
    delete env.ELECTRON_RUN_AS_NODE
    delete env.KISAKI_RENDERER_URL

    const application = await _electron.launch({
      executablePath: electronExecutable(),
      args: [join(runtime, 'main/entry.js')],
      env,
    })
    const child = application.process()

    try {
      await use(application)
    } finally {
      if (child.exitCode === null) await application.close()
    }
  },
})

export { expect } from '@playwright/test'
