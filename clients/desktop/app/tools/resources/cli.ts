import { parseArgs } from 'node:util'
import { hostTarget, parseTarget } from '../lib/targets'
import { prepareResources } from './prepare'

try {
  const { values } = parseArgs({ options: { target: { type: 'string' } } })
  const target = values.target ? parseTarget(values.target) : hostTarget()

  console.info(await prepareResources(target))
} catch (cause) {
  console.error(cause)
  process.exitCode = 1
}
