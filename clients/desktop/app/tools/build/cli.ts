import { parseArgs } from 'node:util'
import { join } from 'node:path'
import { appRoot } from '../lib/paths'
import { hostTarget, parseTarget } from '../lib/targets'
import { replaceOutput } from '../lib/output'
import { buildDesktop } from './coordinator'
import { sourceIdentity } from './identity'
import { buildProgram, programNames } from './programs'
import type { ProgramName } from './programs'

try {
  const { values } = parseArgs({
    options: { target: { type: 'string' }, program: { type: 'string' } },
  })
  const target = values.target ? parseTarget(values.target) : hostTarget()
  if (values.program) {
    if (!programNames.some((program) => program === values.program)) {
      throw new Error('Unknown desktop program')
    }
    const program = values.program as ProgramName
    const buildId = await sourceIdentity()
    await replaceOutput(join(appRoot, 'out', 'programs', target, program), (staging) =>
      buildProgram(program, staging, buildId),
    )
  } else {
    const build = await buildDesktop(target)
    console.info(`Desktop build ready: ${build.target} ${build.buildId}`)
  }
} catch (cause) {
  console.error(cause)
  process.exitCode = 1
}
