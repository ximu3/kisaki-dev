/** @fileoverview Prepares the small input application used only by engineering integration tests. */

import { join } from 'node:path'
import { appRoot } from '../../tools/lib/paths'
import { hostTarget } from '../../tools/lib/targets'
import { buildDesktop } from '../../tools/build/coordinator'
import { runCli } from '@kisaki3/tooling/cli'

await runCli(async (signal) => {
  await buildDesktop(join(appRoot, 'tests/fixtures/runtime'), hostTarget(), signal)
})
