/** @fileoverview Owns the editable carrier and its one mutable package for development tests. */

import { cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { appRoot } from '../../../tools/lib/paths'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'

/** Copies editable inputs and links read-only dependencies and product sources into their normal locations. */
export async function prepareDevelopmentWorkspace() {
  const parent = join(appRoot, 'out/development')
  await mkdir(parent, { recursive: true })
  const root = await mkdtemp(join(parent, 'test-'))
  const app = join(root, 'app')
  const dependencies = join(app, 'node_modules')
  const contracts = join(root, 'desktop-contracts')
  const linkedPackages = join(root, 'node_modules/@kisaki3')

  /** Removes only inputs and links owned by this test after its readers exit. */
  const close = () => rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  try {
    await cp(join(appRoot, 'tests/fixtures/desktop-app'), join(app, 'tests/fixtures/desktop-app'), {
      recursive: true,
    })
    await cp(join(appRoot, 'package.json'), join(app, 'package.json'))
    for (const directory of ['src', 'native']) {
      await symlink(join(appRoot, directory), join(app, directory), 'junction')
    }

    const packageRoot = join(appRoot, '../packages/desktop-contracts')
    await cp(join(packageRoot, 'src'), join(contracts, 'src'), { recursive: true })
    await cp(join(packageRoot, 'package.json'), join(contracts, 'package.json'))
    await symlink(join(packageRoot, 'node_modules'), join(contracts, 'node_modules'), 'junction')
    await mkdir(linkedPackages, { recursive: true })
    for (const name of ['desktop-appearance', 'extension-distribution']) {
      await symlink(join(appRoot, '../packages', name), join(linkedPackages, name), 'junction')
    }
    await mkdir(join(dependencies, '@kisaki3'), { recursive: true })
    await symlink(contracts, join(dependencies, '@kisaki3/desktop-contracts'), 'junction')
    return { app, contracts, close }
  } catch (cause) {
    return rethrowAfterCleanup(cause, close, 'Development test preparation and cleanup failed')
  }
}
