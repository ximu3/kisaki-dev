import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appRoot } from '../lib/paths'
import { hostTarget, targetTriples } from '../lib/targets'
import type { DesktopTarget } from '../../src/shared/runtime-manifest'
import { replaceOutput, run, runPnpm } from '../../../../../tools/outputs'
import { checkDeclarations } from './declarations'

/** Compile the host target and replace its output after the generated declarations match. */
export async function buildNative(
  target: DesktopTarget,
  updateDeclarations = false,
  signal?: AbortSignal,
): Promise<string> {
  if (target !== hostTarget()) {
    throw new Error('Native builds require the matching target runner')
  }

  const output = join(appRoot, 'out', 'native', target)
  await replaceOutput(
    appRoot,
    output,
    async (staging) => {
      await run('rustup', ['target', 'add', targetTriples[target]], {
        cwd: join(appRoot, 'native'),
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
          staging,
          '--target',
          targetTriples[target],
          '--release',
          '--no-js',
          '--dts',
          'binding.d.ts',
          '--',
          '--locked',
        ],
        { cwd: appRoot },
      )

      await checkDeclarations(
        join(staging, 'binding.d.ts'),
        join(appRoot, 'native', 'node', 'binding.d.ts'),
        updateDeclarations,
      )

      const bytes = await readFile(join(staging, 'kisaki-native.node'))
      await writeFile(
        join(staging, 'native.json'),
        JSON.stringify({
          target,
          nodeApi: 8,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        }),
      )
    },
    signal ? { signal } : {},
  )

  return output
}
