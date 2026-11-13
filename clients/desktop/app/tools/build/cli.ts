/** @fileoverview Parses target and program arguments for finite desktop builds. */

import { parseArgs } from 'node:util'
import { randomUUID } from 'node:crypto'
import { join, resolve } from 'node:path'
import { appRoot } from '../lib/paths'
import { hostTarget, parseTarget } from '../lib/targets'
import { removeOutputs } from '@kisaki3/tooling/output'
import { runCli } from '@kisaki3/tooling/cli'
import { buildDesktop } from './coordinator'
import { buildProgram, programNames } from './programs'
import type { ProgramName } from './programs'

await runCli(async (signal) => {
  const { values } = parseArgs({
    options: {
      source: { type: 'string' },
      target: { type: 'string' },
      program: { type: 'string' },
    },
  })
  if (!values.source) {
    throw new Error('Build source directory is required')
  }
  const sourceRoot = resolve(appRoot, values.source)
  const target = values.target ? parseTarget(values.target) : hostTarget()

  if (values.program) {
    if (!programNames.some((program) => program === values.program)) {
      throw new Error('Unknown desktop program')
    }

    const program = values.program as ProgramName
    const output = join(appRoot, 'out', 'programs', target, program)
    await removeOutputs(appRoot, [output], signal)
    await buildProgram(sourceRoot, program, output, randomUUID())
    signal.throwIfAborted()
  } else {
    const build = await buildDesktop(sourceRoot, target, signal)

    console.info(`Desktop build ready: ${build.target} ${build.buildId}`)
  }
})
