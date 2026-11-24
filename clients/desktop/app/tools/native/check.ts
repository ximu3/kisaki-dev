import { join } from 'node:path'
import { appRoot } from '../lib/paths'
import { hostTarget, nativeBuildEnvironment } from '../lib/targets'
import { run } from '@kisaki3/tooling/process'

export async function checkNative(signal?: AbortSignal): Promise<void> {
  const cwd = join(appRoot, 'native')
  await run('cargo', ['fmt', '--all', '--check'], { cwd, signal })
  await run('cargo', ['clippy', '--locked', '--all-targets', '--', '-D', 'warnings'], {
    cwd,
    signal,
    env: {
      ...nativeBuildEnvironment(),
      CARGO_TARGET_DIR: join(appRoot, '.cache', 'native', hostTarget()),
    },
  })
}
