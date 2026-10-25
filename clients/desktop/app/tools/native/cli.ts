import { parseArgs } from 'node:util'
import { hostTarget, parseTarget } from '../lib/targets'
import { buildNative } from './build'
import { checkNative } from './check'
import { runCli } from '@repo-tools/cli'

await runCli(async (signal) => {
  const { values } = parseArgs({
    options: {
      target: { type: 'string' },
      'update-declarations': { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
    },
  })
  const target = values.target ? parseTarget(values.target) : hostTarget()
  if (values.check) {
    if (target !== hostTarget() || values['update-declarations']) {
      throw new Error('Native checks use the host target and do not update declarations')
    }
    await checkNative(signal)
  } else {
    console.info(await buildNative(target, values['update-declarations'], signal))
  }
})
