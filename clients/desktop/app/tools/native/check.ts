import { join } from 'node:path'
import { appRoot } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import { run, withOutputs } from '../../../../../tools/outputs'

/** Check maintained Rust sources in the crate's pinned toolchain and target cache. */
export async function checkNative(signal?: AbortSignal): Promise<void> {
  const cwd = join(appRoot, 'native')
  await withOutputs(
    [{ project: appRoot, mode: 'use', write: [join(appRoot, 'out', 'native', hostTarget())] }],
    async () => {
      await run('cargo', ['fmt', '--all', '--check'], { cwd })
      await run('cargo', ['clippy', '--locked', '--all-targets', '--', '-D', 'warnings'], {
        cwd,
        env: { ...process.env, CARGO_TARGET_DIR: join(appRoot, '.cache', 'native', hostTarget()) },
      })
    },
    signal ? { signal } : {},
  )
}
