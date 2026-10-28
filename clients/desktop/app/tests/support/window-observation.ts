import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execute = promisify(execFile)

/** Run a native window command and wait for its streams to close after cancellation. */
async function runWindowCommand(
  command: string,
  args: string[],
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted()
  const result = execute(command, args, { windowsHide: true, encoding: 'utf8', signal })
  const closed = new Promise<void>((resolve) => result.child.once('close', () => resolve()))
  try {
    return (await result).stdout
  } finally {
    await closed
  }
}

/** Observe native windows for the supplied process ID; cancellation closes the observation command. */
export async function hasNativeWindow(pid: number, signal?: AbortSignal): Promise<boolean> {
  if (process.platform === 'win32') {
    // Direct .NET access does not depend on PowerShell module discovery in the task environment.
    const stdout = await runWindowCommand(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$p = $null; try { $p = [System.Diagnostics.Process]::GetProcessById(${pid}); $p.MainWindowHandle.ToInt64() } catch [System.ArgumentException] { 0 } finally { if ($p) { $p.Dispose() } }`,
      ],
      signal,
    )
    return Number(stdout.trim()) > 0
  }
  if (process.platform === 'darwin') {
    const stdout = await runWindowCommand(
      'osascript',
      [
        '-e',
        `tell application "System Events" to count windows of (first process whose unix id is ${pid})`,
      ],
      signal,
    )
    return Number(stdout.trim()) > 0
  }
  if (process.env.XDG_SESSION_TYPE === 'wayland') {
    throw new Error(
      'Use the documented native Wayland observation procedure; X11 observation is not a substitute',
    )
  }
  const stdout = await runWindowCommand('wmctrl', ['-lp'], signal)
  return stdout.split('\n').some((line) => Number(line.trim().split(/\s+/)[2]) === pid)
}

/** Request ordinary window closure; cancellation closes the command without undoing a sent request. */
export async function closeNativeWindow(pid: number, signal?: AbortSignal): Promise<void> {
  if (process.platform === 'win32') {
    const stdout = await runWindowCommand(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$p = $null; try { $p = [System.Diagnostics.Process]::GetProcessById(${pid}); $p.CloseMainWindow() } finally { if ($p) { $p.Dispose() } }`,
      ],
      signal,
    )
    if (stdout.trim() !== 'True') {
      throw new Error('The packaged window did not accept a close request')
    }
  } else if (process.platform === 'darwin') {
    await runWindowCommand(
      'osascript',
      [
        '-e',
        `tell application "System Events" to tell (first process whose unix id is ${pid}) to click (first button of first window whose subrole is "AXCloseButton")`,
      ],
      signal,
    )
  } else {
    const stdout = await runWindowCommand('wmctrl', ['-lp'], signal)
    const line = stdout.split('\n').find((value) => Number(value.trim().split(/\s+/)[2]) === pid)
    const id = line?.trim().split(/\s+/)[0]
    if (!id || !/^0x[0-9a-f]+$/i.test(id)) {
      throw new Error('The packaged window is no longer available')
    }
    await runWindowCommand('wmctrl', ['-ic', id], signal)
  }
}
