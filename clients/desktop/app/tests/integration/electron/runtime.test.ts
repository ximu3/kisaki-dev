import { build } from 'vite-plus'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile } from 'node:fs/promises'
import { test } from '../../support/electron'
import { electronExecutable } from '../../../tools/dev/electron-executable'

async function buildProbe(profile: string, source: string) {
  const output = join(profile, 'probe')
  await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      ssr: true,
      outDir: output,
      lib: {
        entry: join(import.meta.dirname, 'probes', source),
        formats: ['cjs'],
        fileName: () => 'runtime.cjs',
      },
      rolldownOptions: {
        external: [/^node:/, 'electron'],
        output: { format: 'cjs', entryFileNames: 'runtime.cjs' },
      },
    },
    ssr: { noExternal: true },
  })
  return join(output, 'runtime.cjs')
}

test('host requests, browser sockets and scoped byte reads follow their independent lifetimes', async ({
  desktop,
  profile,
}) => {
  await (
    await desktop.firstWindow()
  )
    .getByRole('button', { name: 'Task center', exact: true })
    .waitFor()
  const entry = await buildProbe(profile, 'index.ts')
  await desktop.evaluate(
    async (_, { entry, certificates, profile }) => {
      const { createRequire } = process.getBuiltinModule('node:module')
      const probe = createRequire(entry)(entry) as {
        verifyNetwork(): Promise<void>
        verifyBrowserRoutes(directory: string): Promise<void>
        verifyResourceBindings(directory: string): Promise<void>
      }
      await probe.verifyNetwork()
      await probe.verifyBrowserRoutes(certificates)
      await probe.verifyResourceBindings(profile)
    },
    {
      profile,
      entry,
      certificates: join(import.meta.dirname, '../../fixtures/network'),
    },
  )
})

test('the Linux notification service activates the destination submitted by the desktop', async ({
  profile,
}) => {
  test.skip(process.platform !== 'linux', 'Exercises the Freedesktop notification service')
  const entry = await buildProbe(profile, 'notifications/app.ts')
  const data = join(profile, 'data')
  const services = join(data, 'dbus-1', 'services')
  await mkdir(services, { recursive: true })
  // This private bus can start a second process after the original notification sender disconnects.
  await writeFile(
    join(services, 'me.kisaki.dev.service'),
    `[D-BUS Service]\nName=me.kisaki.dev\nExec="${electronExecutable()}" "${entry}" --restore-notification\n`,
  )
  // The daemon inherits its own display and bus. Activating its first notification cannot touch another desktop.
  await promisify(execFile)(
    'xvfb-run',
    ['--auto-servernum', 'dbus-run-session', '--', electronExecutable(), entry],
    {
      cwd: profile,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: undefined,
        XDG_DATA_HOME: data,
        XDG_CONFIG_HOME: join(profile, 'config'),
        XDG_CACHE_HOME: join(profile, 'cache'),
      },
    },
  )
})
