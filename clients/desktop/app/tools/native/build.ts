import { NapiCli } from '@napi-rs/cli'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appRoot } from '../lib/paths'
import { hostTarget, targetTriples } from '../lib/targets'
import type { DesktopTarget } from '../../src/shared/runtime-manifest'
import { replaceOutput } from '../lib/output'
import { checkDeclarations } from './declarations'
import { run } from '../lib/process'

/** Compile the host target and replace its output after the generated declarations match. */
export async function buildNative(
  target: DesktopTarget,
  updateDeclarations = false,
): Promise<string> {
  if (target !== hostTarget()) {
    throw new Error('Native builds require the matching target runner')
  }

  const output = join(appRoot, 'out', 'native', target)
  await replaceOutput(output, async (staging) => {
    await run('rustup', ['target', 'add', targetTriples[target]], { cwd: join(appRoot, 'native') })

    const build = await new NapiCli().build({
      cwd: join(appRoot, 'native'),
      manifestPath: join(appRoot, 'native', 'Cargo.toml'),
      packageJsonPath: join(appRoot, 'package.json'),
      targetDir: join(appRoot, '.cache', 'native', target),
      outputDir: staging,
      target: targetTriples[target],
      release: true,
      noJsBinding: true,
      dts: 'binding.d.ts',
      cargoOptions: ['--locked'],
    })
    await build.task

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
  })

  return output
}
