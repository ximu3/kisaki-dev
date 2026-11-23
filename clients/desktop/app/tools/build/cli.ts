import { parseArgs } from 'node:util'
import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import { appRoot } from '../lib/paths'
import { hostTarget, parseTarget } from '../lib/targets'
import { removeOutputs } from '@kisaki3/tooling/output'
import { runCli } from '@kisaki3/tooling/cli'
import { buildDesktop } from './coordinator'
import { buildProgram, programNames } from './programs'

await runCli(async (signal) => {
  const { values } = parseArgs({
    options: {
      source: { type: 'string' },
      target: { type: 'string' },
      program: { type: 'string' },
    },
  })
  const sourceRoot = resolve(appRoot, values.source ?? '.')
  const target = values.target ? parseTarget(values.target) : hostTarget()

  if (values.program) {
    const program = programNames.find((name) => name === values.program)
    if (!program) {
      throw new Error('Unknown desktop program')
    }

    const output = join(appRoot, 'out', 'programs', target, program)
    await removeOutputs(appRoot, [output], signal)
    await buildProgram(sourceRoot, program, output, randomUUID())
    signal.throwIfAborted()
    return
  }

  const build = await buildDesktop(sourceRoot, target, signal)
  console.info(`Desktop build ready: ${build.target} ${build.buildId}`)
})
