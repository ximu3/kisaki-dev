import { parseArgs } from 'node:util'
import { join } from 'node:path'
import { runCli, runPnpm, withProjectOutputs } from '../../../../tools/outputs'
import { appRoot, buildDirectory } from './lib/paths'
import { hostTarget } from './lib/targets'

await runCli(async (signal) => {
  const { values, positionals } = parseArgs({
    options: {
      runtime: { type: 'boolean', default: false },
      artifacts: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  })
  if (!positionals.length) throw new Error('A pnpm command is required')
  const target = hostTarget()
  const read: string[] = []
  if (values.runtime) read.push(buildDirectory(target))
  if (values.artifacts) read.push(join(appRoot, 'dist', target))
  await withProjectOutputs(appRoot, { read }, () => runPnpm(positionals, { cwd: appRoot }), {
    signal,
  })
})
