import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execute = promisify(execFile)

/** Observe native windows for the supplied process ID through the desktop APIs. */
export async function hasNativeWindow(pid: number): Promise<boolean> {
  if (process.platform === 'win32') {
    const { stdout } = await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($p) { $p.MainWindowHandle.ToInt64() }`,
      ],
      { windowsHide: true },
    )
    return Number(stdout.trim()) > 0
  }
  if (process.platform === 'darwin') {
    const { stdout } = await execute('osascript', [
      '-e',
      `tell application "System Events" to count windows of (first process whose unix id is ${pid})`,
    ])
    return Number(stdout.trim()) > 0
  }
  if (process.env.XDG_SESSION_TYPE === 'wayland') {
    throw new Error(
      'Use the documented native Wayland observation procedure; X11 observation is not a substitute',
    )
  }
  const { stdout } = await execute('wmctrl', ['-lp'])
  return stdout.split('\n').some((line) => Number(line.trim().split(/\s+/)[2]) === pid)
}

/** Request ordinary closure of a native window belonging to the supplied process ID. */
export async function closeNativeWindow(pid: number): Promise<void> {
  if (process.platform === 'win32') {
    const { stdout } = await execute(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$p = Get-Process -Id ${pid} -ErrorAction Stop; $p.CloseMainWindow()`,
      ],
      { windowsHide: true },
    )
    if (stdout.trim() !== 'True') {
      throw new Error('The packaged window did not accept a close request')
    }
  } else if (process.platform === 'darwin') {
    await execute('osascript', [
      '-e',
      `tell application "System Events" to tell (first process whose unix id is ${pid}) to click (first button of first window whose subrole is "AXCloseButton")`,
    ])
  } else {
    const { stdout } = await execute('wmctrl', ['-lp'])
    const line = stdout.split('\n').find((value) => Number(value.trim().split(/\s+/)[2]) === pid)
    const id = line?.trim().split(/\s+/)[0]
    if (!id || !/^0x[0-9a-f]+$/i.test(id)) {
      throw new Error('The packaged window is no longer available')
    }
    await execute('wmctrl', ['-ic', id])
  }
}
