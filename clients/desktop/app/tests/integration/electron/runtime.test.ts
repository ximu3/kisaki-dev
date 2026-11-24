import { join } from 'node:path'
import { test } from '../../support/electron'
import { buildProbe } from './probes/build'

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
