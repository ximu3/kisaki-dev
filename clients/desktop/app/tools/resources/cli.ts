/** @fileoverview Selects a desktop target and prepares its declared runtime resources. */

import { parseArgs } from 'node:util'
import { hostTarget, parseTarget } from '../lib/targets'
import { prepareResources } from './prepare'
import { runCli } from '@kisaki3/tooling/cli'

await runCli(async (signal) => {
  const { values } = parseArgs({ options: { target: { type: 'string' } } })
  const target = values.target ? parseTarget(values.target) : hostTarget()

  console.info(await prepareResources(target, signal))
})
