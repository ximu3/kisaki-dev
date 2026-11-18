/** @fileoverview Records bounded local startup and shutdown diagnostics without retaining business input or credentials. */

import { appendFile, mkdir, rename, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Opens the runtime log for this verified local root; one previous file is kept across rotation. */
export async function createRuntimeLog(root: string) {
  const directory = join(root, 'logs')
  const file = join(directory, 'runtime.log')
  await mkdir(directory, { recursive: true })
  const size = await stat(file).then(
    (info) => info.size,
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        return 0
      }
      throw error
    },
  )
  if (size >= 1024 * 1024) {
    await rename(file, join(directory, 'runtime.previous.log'))
  }
  let pending = Promise.resolve()
  const startupSteps = new Set<string>()

  /** Serializes safe process milestones and records only the stable category of a failure. */
  function record(
    event:
      | 'opening'
      | 'ready'
      | 'closing'
      | 'closed'
      | 'failed'
      | 'storage-open'
      | 'document-loading'
      | 'document-loaded'
      | 'window-connected'
      | 'window-ready'
      | 'attachment-cleanup-failed',
    cause?: unknown,
  ) {
    if (!['failed', 'closing', 'closed', 'attachment-cleanup-failed'].includes(event)) {
      if (startupSteps.has(event)) {
        return pending
      }
      startupSteps.add(event)
    }
    const item = {
      time: new Date().toISOString(),
      event,
      buildId: __KISAKI_BUILD_ID__,
      ...(cause !== undefined && {
        code: cause instanceof DesktopError ? cause.code : 'OperationFailed',
      }),
    }
    pending = pending
      .then(() => appendFile(file, JSON.stringify(item) + '\n', { mode: 0o600 }))
      .catch((error) => console.error('Runtime log write failed', error))
    return pending
  }
  return { record }
}
