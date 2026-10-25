import { join } from 'node:path'
import { appRoot } from '../lib/paths'
import { hostTarget } from '../lib/targets'
import { run } from '../../../../../tools/lib/process'

/** Check maintained Rust sources in the crate's pinned toolchain and target cache. */
export async function checkNative(signal?: AbortSignal): Promise<void> {
  const cwd = join(appRoot, 'native')
  await run('cargo', ['fmt', '--all', '--check'], { cwd, signal })
  await run('cargo', ['clippy', '--locked', '--all-targets', '--', '-D', 'warnings'], {
    cwd,
    signal,
    env: { ...process.env, CARGO_TARGET_DIR: join(appRoot, '.cache', 'native', hostTarget()) },
  })
}
