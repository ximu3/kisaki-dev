import { createHash } from 'node:crypto'
import { lstat, mkdir, mkdtemp, open, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Transform, type Readable } from 'node:stream'
import { finished, pipeline } from 'node:stream/promises'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { isAbsoluteHostPath } from '#host-path'
import type { NativeFiles } from '#native'

/** Completed bytes held in one exclusively owned preparation directory. */
export interface StagedFile {
  readonly path: string
  readonly byteSize: number
  readonly sha256: string
  /** Releases this preparation directory after its consumer has finished. */
  dispose(): Promise<void>
}

/** Synchronizes a POSIX namespace; Windows publication uses native write-through moves. */
export async function syncDirectory(path: string): Promise<void> {
  if (!isAbsoluteHostPath(path)) {
    throw new TypeError('Expected an absolute directory path')
  }
  if (process.platform === 'win32') {
    return
  }
  const directory = await open(path, 'r')
  try {
    await directory.sync()
  } finally {
    await directory.close()
  }
}

/**
 * Moves to an absent destination and completes the platform's namespace barriers.
 *
 * The move may already have succeeded if a later synchronization fails. It never overwrites a
 * destination or emulates a cross-filesystem move through copy-and-delete.
 */
export async function publishPath(
  source: string,
  target: string,
  native: NativeFiles,
  barrierFile?: string,
): Promise<void> {
  await native.moveNoReplace(source, target)
  await syncDirectory(dirname(source))
  if (dirname(source) !== dirname(target)) {
    await syncDirectory(dirname(target))
  }
  if (process.platform === 'darwin' && barrierFile) {
    await native.syncFile(barrierFile)
  }
}

/** Maps an opaque attachment identity to a fixed, portable path without using content as identity. */
export function storedFilePath(root: string, id: string): string {
  if (!isAbsoluteHostPath(root) || id.length === 0 || /[\uD800-\uDFFF]/u.test(id)) {
    throw new TypeError('Expected an absolute storage root and a nonempty scalar identity')
  }
  const key = createHash('sha256').update(id, 'utf8').digest('hex')
  return join(root, key.slice(0, 2), key.slice(2))
}

/**
 * Copies a byte stream into an owned temporary file, hashing and enforcing its actual byte limit.
 *
 * Takes ownership of the input. Failure releases the streams and preparation. Cancellation
 * waits for pending synchronization before cleanup. On success the caller owns the file and its disposal.
 */
export async function stageFile(
  temporaryRoot: string,
  source: Readable,
  native: NativeFiles,
  byteLimit: number,
  signal?: AbortSignal,
): Promise<StagedFile> {
  const completion = finished(source, { cleanup: true })
  // The input can fail while the destination directory is being prepared.
  void completion.catch(() => {})
  const hash = createHash('sha256')
  let byteSize = 0
  let directory: string | undefined

  /** Removes only the exclusively created preparation directory. */
  async function dispose(): Promise<void> {
    if (directory === undefined) {
      return
    }
    await rm(directory, { recursive: true, force: true })
    directory = undefined
  }

  try {
    if (!isAbsoluteHostPath(temporaryRoot) || !Number.isSafeInteger(byteLimit) || byteLimit < 0) {
      throw new TypeError('Expected an absolute preparation root and a nonnegative safe byte limit')
    }
    signal?.throwIfAborted()
    await mkdir(temporaryRoot, { recursive: true })
    if (!(await lstat(temporaryRoot)).isDirectory()) {
      throw new DesktopError('PathConflict', 'The staging directory has been replaced')
    }
    directory = await mkdtemp(join(temporaryRoot, 'file-'))
    const path = join(directory, 'content')
    const output = await open(path, 'wx')
    try {
      if (source.errored) {
        throw source.errored
      }
      await pipeline(
        source,
        new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            byteSize += chunk.length
            if (!Number.isSafeInteger(byteSize) || byteSize > byteLimit) {
              callback(
                new DesktopError('ResourceLimit', 'The file exceeds the preparation byte limit'),
              )
              return
            }
            hash.update(chunk)
            callback(null, chunk)
          },
        }),
        output.createWriteStream(),
        { signal },
      )
    } finally {
      await output.close()
    }
    signal?.throwIfAborted()
    await native.syncFile(path)
    await syncDirectory(directory)
    signal?.throwIfAborted()

    return { path, byteSize, sha256: hash.digest('hex'), dispose }
  } catch (error) {
    source.destroy()
    await completion.catch(() => {})
    try {
      await dispose()
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'File preparation and cleanup failed', {
        cause: cleanupError,
      })
    }
    throw error
  }
}

/**
 * Publishes prepared bytes at their immutable app-owned identity.
 *
 * The caller commits business references only after success and retains the stage until then.
 */
export async function publishStoredFile(
  root: string,
  id: string,
  stage: StagedFile,
  native: NativeFiles,
): Promise<string> {
  const path = storedFilePath(root, id)
  await mkdir(dirname(path), { recursive: true })
  await syncDirectory(root)
  await publishPath(stage.path, path, native, path)
  return path
}
