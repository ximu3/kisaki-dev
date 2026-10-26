import { parseArgs } from 'node:util'
import { join } from 'node:path'
import { appRoot } from '../lib/paths'
import { hostTarget, parseTarget } from '../lib/targets'
import { replaceOutput } from '@kisaki3/tooling/output'
import { runCli } from '@kisaki3/tooling/cli'
import { buildDesktop } from './coordinator'
import { sourceIdentity } from './identity'
import { buildProgram, programNames } from './programs'
import type { ProgramName } from './programs'

await runCli(async (signal) => {
  const { values } = parseArgs({
    options: { target: { type: 'string' }, program: { type: 'string' } },
  })
  const target = values.target ? parseTarget(values.target) : hostTarget()
  if (values.program) {
    if (!programNames.some((program) => program === values.program)) {
      throw new Error('Unknown desktop program')
    }
    const program = values.program as ProgramName
    const output = join(appRoot, 'out', 'programs', target, program)
    const buildId = await sourceIdentity()
    await replaceOutput(
      appRoot,
      output,
      (staging) => buildProgram(program, staging, buildId),
      signal,
    )
  } else {
    const build = await buildDesktop(target, signal)
    console.info(`Desktop build ready: ${build.target} ${build.buildId}`)
  }
})
