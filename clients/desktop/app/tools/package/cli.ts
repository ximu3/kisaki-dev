import { parseArgs } from 'node:util'
import { hostTarget, parseTarget } from '../lib/targets'
import { packageDesktop } from './packager'
import { runCli } from '../../../../../tools/outputs'

await runCli(async (signal) => {
  const { values } = parseArgs({
    options: { target: { type: 'string' }, 'test-only': { type: 'boolean', default: false } },
  })
  console.info(
    await packageDesktop(
      values.target ? parseTarget(values.target) : hostTarget(),
      values['test-only'],
      signal,
    ),
  )
})
