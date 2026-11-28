import { stat } from 'node:fs/promises'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { FileWorkType } from '@kisaki3/desktop-contracts/library'
import { inspectVideo } from '../../../../infrastructure/media/inspect'
import { inspectBook } from '../reading/inspect'
import type { FileFacts } from './record'

async function inspectMetadata(
  type: FileWorkType,
  path: string,
  resources: string,
  signal: AbortSignal,
): Promise<FileFacts> {
  signal.throwIfAborted()
  if (type === 'anime') {
    return { kind: 'file', video: (await inspectVideo(resources, path, signal)).metadata }
  }
  const before = await stat(path, { bigint: true })
  const result = await inspectBook(path, signal)
  const after = await stat(path, { bigint: true })
  if (
    before.ino !== after.ino ||
    before.dev !== after.dev ||
    before.size !== after.size ||
    before.mtimeNs !== after.mtimeNs
  ) {
    throw new DesktopError('TargetChanged', 'The reading content changed during inspection')
  }
  return { kind: result.kind, book: result.metadata }
}

export async function inspectTarget(
  type: FileWorkType,
  path: string,
  resources: string,
  signal: AbortSignal,
) {
  try {
    return await inspectMetadata(type, path, resources, signal)
  } catch (cause) {
    if (
      cause instanceof Error &&
      'code' in cause &&
      ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM', 'ELOOP'].includes(String(cause.code))
    ) {
      throw new DesktopError('FileUnavailable', 'The content could not be accessed', { cause })
    }
    throw cause
  }
}
