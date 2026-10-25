import { parseArgs } from 'node:util'
import { hostTarget, parseTarget } from '../lib/targets'
import { prepareResources } from './prepare'
import { runCli } from '../../../../../tools/lib/cli'

await runCli(async (signal) => {
  const { values } = parseArgs({ options: { target: { type: 'string' } } })
  const target = values.target ? parseTarget(values.target) : hostTarget()

  console.info(await prepareResources(target, signal))
})
