/** @fileoverview Parses desktop packaging targets and the test-only distribution option. */

import { parseArgs } from 'node:util'
import { hostTarget, parseTarget } from '../lib/targets'
import { packageDesktop } from './packager'
import { runCli } from '@kisaki3/tooling/cli'

await runCli(async (signal) => {
  const { values } = parseArgs({
    options: { target: { type: 'string' }, 'test-only': { type: 'boolean', default: false } },
  })
  const target = values.target ? parseTarget(values.target) : hostTarget()

  const receiptPath = await packageDesktop(target, values['test-only'], signal)

  console.info(receiptPath)
})
