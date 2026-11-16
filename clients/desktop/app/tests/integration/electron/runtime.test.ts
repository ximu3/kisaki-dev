/** @fileoverview Runs the host network fixture against real Chromium sessions in the isolated Electron process. */

import { build } from 'vite-plus'
import { join } from 'node:path'
import { test } from '../../support/electron'

test('host requests, browser sockets and scoped byte reads follow their independent lifetimes', async ({
  desktop,
  profile,
}) => {
  await (
    await desktop.firstWindow()
  )
    .getByRole('button', { name: 'Task center', exact: true })
    .waitFor()
  const output = join(profile, 'probe')
  await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      ssr: true,
      outDir: output,
      lib: {
        entry: join(import.meta.dirname, 'probes/index.ts'),
        formats: ['cjs'],
        /** Gives the isolated fixture an explicit CommonJS entry filename. */
        fileName: () => 'runtime.cjs',
      },
      rolldownOptions: {
        external: [/^node:/, 'electron'],
        output: { format: 'cjs', entryFileNames: 'runtime.cjs' },
      },
    },
    ssr: { noExternal: true },
  })
  await desktop.evaluate(
    async (_, { entry, certificates, profile }) => {
      const { createRequire } = process.getBuiltinModule('node:module')
      const probe = createRequire(entry)(entry) as {
        /** Exercises host HTTP and proxy adoption in the real Electron process. */
        verifyNetwork(): Promise<void>
        /** Tests new and already-established encrypted browser connections separately. */
        verifyBrowserRoutes(directory: string): Promise<void>
        /** Verifies reads, range responses and revocation in actual document sessions. */
        verifyResourceBindings(directory: string): Promise<void>
      }
      await probe.verifyNetwork()
      await probe.verifyBrowserRoutes(certificates)
      await probe.verifyResourceBindings(profile)
    },
    {
      profile,
      entry: join(output, 'runtime.cjs'),
      certificates: join(import.meta.dirname, '../../fixtures/network'),
    },
  )
})
