// Compile-only consumer: no native package is loaded or executed.
import {
  processes,
  windows,
  getForeground,
  observeForeground,
  VantageError,
  type ProcessRef,
  type WindowRef,
  type WindowImage
} from './contract.js'
import { queryPermission, requestPermission, type PermissionStatus } from './macos-contract.js'

export async function consume(signal: AbortSignal): Promise<void> {
  const found = await processes.find(123, { signal })
  if (!found) return

  const listed = await windows.list({ process: found.ref, signal })
  const target = listed[0]
  if (target) {
    const image: WindowImage = await windows.capture(target.ref, { signal })
    const format: 'rgba8' = image.pixelFormat
    void format
    image.data[0] = 0
    await windows.restore(target.ref, { signal })
    await windows.focus(target.ref, { signal })
    await windows.requestClose(target.ref, { signal })

    // @ts-expect-error Process and window references are distinct.
    await windows.capture(found.ref)
    // @ts-expect-error PID values cannot act as instance references.
    await processes.forceTerminate(found.pid)
    // @ts-expect-error Published snapshots are readonly.
    found.pid = 456
    // @ts-expect-error Image metadata cannot be changed through the contract.
    image.width = 1
  }

  const observation = await processes.observe(
    found.ref,
    (event) => {
      if (event.type === 'interrupted') {
        const code = event.error.code
        void code
        return
      }
      if (event.value?.executablePath.status === 'available') {
        const path: string = event.value.executablePath.value
        void path
      }
    },
    { signal }
  )
  await observation.dispose()

  const foreground = await getForeground({ signal })
  if (foreground.window.status === 'available' && foreground.window.value) {
    await windows.get(foreground.window.value, { signal })
  }
  const foregroundObservation = await observeForeground(() => {}, { signal })
  await foregroundObservation.dispose()

  if (process.platform === 'darwin') {
    const status: PermissionStatus = await queryPermission('screenCapture', { signal })
    void status
  }
  try {
    await windows.list({ signal })
  } catch (error) {
    if (
      error instanceof VantageError &&
      error.code === 'permissionDenied' &&
      process.platform === 'darwin'
    ) {
      const permissionStatus = await queryPermission('accessibility', { signal })
      void permissionStatus
    }
  }

  // @ts-expect-error A plain object cannot construct a process reference.
  const forgedProcess: ProcessRef = {}
  // @ts-expect-error A plain object cannot construct a window reference.
  const forgedWindow: WindowRef = {}
  void forgedProcess
  void forgedWindow
  // @ts-expect-error Host-owned deadlines use AbortSignal.
  await processes.list({ timeoutMs: 500 })
  // @ts-expect-error Authorization categories are explicit.
  await requestPermission('all')
}
