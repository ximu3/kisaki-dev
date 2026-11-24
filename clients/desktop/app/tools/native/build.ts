import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { appRoot } from '../lib/paths'
import {
  hostTarget,
  nativeBuildEnvironment,
  targetTriples,
  type DesktopTarget,
} from '../lib/targets'
import { removeOutputs } from '@kisaki3/tooling/output'
import { run, runPnpm } from '@kisaki3/tooling/process'
import { checkDeclarations } from './declarations'

interface NativeBuildOptions {
  target: DesktopTarget
  output?: string
  signal?: AbortSignal
  updateDeclarations?: boolean
}

export async function buildNative({
  target,
  output = join(appRoot, 'out', 'native', target),
  signal,
  updateDeclarations = false,
}: NativeBuildOptions): Promise<string> {
  if (target !== hostTarget()) {
    throw new Error('Native builds require the matching target runner')
  }

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
    { cwd: appRoot, env: nativeBuildEnvironment(), signal },
  )

  await checkDeclarations(
    join(output, 'binding.d.ts'),
    join(appRoot, 'native', 'node', 'binding.d.ts'),
    updateDeclarations,
  )

  signal?.throwIfAborted()

  return output
}
