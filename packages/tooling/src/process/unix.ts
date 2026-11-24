import { execFile } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'

async function signalGroup(group: number, signal: NodeJS.Signals | 0): Promise<boolean> {
  try {
    process.kill(-group, signal)
    return true
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code
    if (code === 'ESRCH') {
      return false
    }
    if (process.platform === 'darwin' && code === 'EPERM') {
      // Darwin can return EPERM after the final live member exits but before the group is reaped.
      const { stdout } = await promisify(execFile)('/bin/ps', ['-axo', 'pgid=,stat='])
      const live = stdout
        .trim()
        .split('\n')
        .some((line) => {
          const [pgid, state] = line.trim().split(/\s+/)
          return Number(pgid) === group && !state?.startsWith('Z')
        })
      if (!live) {
        return false
      }
    }
    throw cause
  }
}

export async function stopProcessGroup(group: number): Promise<void> {
  if (!(await signalGroup(group, 'SIGTERM'))) {
    return
  }
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if (!(await signalGroup(group, 0))) {
      return
    }
    await delay(50)
  }
  await signalGroup(group, 'SIGKILL')
}
