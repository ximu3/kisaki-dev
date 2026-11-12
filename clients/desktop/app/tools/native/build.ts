/** @fileoverview Builds the host-native binding and checks its generated Node declarations. */

import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { appRoot } from '../lib/paths'
import { hostTarget, targetTriples } from '../lib/targets'
import type { DesktopTarget } from '../lib/runtime-manifest'
import { removeOutputs } from '@kisaki3/tooling/output'
import { run, runPnpm } from '@kisaki3/tooling/process'
import { checkDeclarations } from './declarations'

/**
 * Builds a native binding for the current runner's target.
 *
 * Returns the prepared output directory after declaration checks.
 * updateDeclarations also replaces the tracked binding declaration with generated output for
 * review.
 */
export async function buildNative(
  target: DesktopTarget,
  updateDeclarations = false,
  signal?: AbortSignal,
): Promise<string> {
  if (target !== hostTarget()) {
    throw new Error('Native builds require the matching target runner')
  }

  const output = join(appRoot, 'out', 'native', target)

  await removeOutputs(appRoot, [output], signal)
  await mkdir(output, { recursive: true })

  await run('rustup', ['target', 'add', targetTriples[target]], {
    cwd: join(appRoot, 'native'),
    signal,
  })

  await runPnpm(
    [
      'exec',
      'napi',
      'build',
      '--cwd',
      join(appRoot, 'native'),
      '--manifest-path',
      join(appRoot, 'native', 'Cargo.toml'),
      '--package-json-path',
      join(appRoot, 'package.json'),
      '--target-dir',
      join(appRoot, '.cache', 'native', target),
      '--output-dir',
      output,
      '--target',
      targetTriples[target],
      '--release',
      '--no-js',
      '--dts',
      'binding.d.ts',
      '--',
      '--locked',
    ],
    { cwd: appRoot, signal },
  )

  await checkDeclarations(
    join(output, 'binding.d.ts'),
    join(appRoot, 'native', 'node', 'binding.d.ts'),
    updateDeclarations,
  )

  signal?.throwIfAborted()

  return output
}
