import { parseArgs } from 'node:util'
import { hostTarget, parseTarget } from '../lib/targets'
import { packageDesktop } from './packager'
import { runCli } from '@kisaki3/tooling/cli'

await runCli(async (signal) => {
  const { values } = parseArgs({
    options: {
      target: { type: 'string' },
      'test-only': { type: 'boolean', default: false },
      'smoke-only': { type: 'boolean', default: false },
    },
  })
  const target = values.target ? parseTarget(values.target) : hostTarget()

  const receiptPath = await packageDesktop(target, {
    testOnly: values['test-only'],
    smokeOnly: values['smoke-only'],
    signal,
  })

  console.info(receiptPath)
})
