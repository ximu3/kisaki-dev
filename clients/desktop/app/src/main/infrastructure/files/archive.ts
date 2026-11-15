/** @fileoverview Reads and writes bounded Store/Deflate ZIP archives, preserving exact member paths and complete byte validation. */

import { openPromise } from 'yauzl'
import type { Entry, ZipFile as InputZip } from 'yauzl'
import { ZipWriter } from '@zip.js/zip.js'
import { crc32 } from 'node:zlib'
import { PassThrough, Readable, Transform, Writable } from 'node:stream'
import { finished, pipeline } from 'node:stream/promises'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { NativeFiles } from '#native'
import { stageFile } from './storage'
import type { StagedFile } from './storage'

/** Actual expansion and metadata budgets supplied by the archive's owning operation. */
export interface ArchiveLimits {
  readonly entries: number
  readonly namesBytes: number
  readonly entryBytes: number
  readonly totalBytes: number
  readonly archiveBytes: number
}

/** A canonical relative member identity, with directory markers kept separate from the path. */
export interface ArchiveMember {
  readonly path: string
  readonly type: 'file' | 'directory'
  readonly byteSize: number
}

/** One input member; file streams transfer to the archive writer and are consumed sequentially. */
export type ArchiveInput =
  | { readonly path: string; readonly type: 'directory' }
  | {
      readonly path: string
      readonly type: 'file'
      readonly byteSize: number
      readonly data: Readable
    }

/** Rejects member aliases and traversal while retaining original case and Unicode spelling. */
export function parseArchivePath(path: string): string {
  if (
    !path ||
    /[\uD800-\uDFFF]/u.test(path) ||
    path.includes('\0') ||
    path.includes('\\') ||
    path.startsWith('/') ||
    /^[a-z]:/iu.test(path) ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new DesktopError('DataIntegrityError', 'The archive contains an invalid member path')
  }
  return path
}

/** Owns bounded member uniqueness, parent-kind and byte-count checks for one archive. */
class ArchiveBudget {
  private readonly members = new Set<string>()
  private readonly files = new Set<string>()
  private readonly directories = new Set<string>()

  private namesBytes = 0
  private totalBytes = 0

  /** Establishes finite nonnegative byte and entry budgets before accepting archive work. */
  constructor(private readonly limits: ArchiveLimits) {
    if (Object.values(limits).some((value) => !Number.isSafeInteger(value) || value < 0)) {
      throw new TypeError('Archive budgets must be nonnegative safe integers')
    }
  }

  /** Admits a member only when its complete declared work fits the remaining budget. */
  add(member: ArchiveMember): void {
    parseArchivePath(member.path)
    if (this.members.has(member.path)) {
      throw new DesktopError('DataIntegrityError', 'The archive contains duplicate members')
    }
    if (
      !Number.isSafeInteger(member.byteSize) ||
      member.byteSize < 0 ||
      member.byteSize > this.limits.entryBytes ||
      this.totalBytes > this.limits.totalBytes - member.byteSize ||
      this.members.size >= this.limits.entries
    ) {
      throw new DesktopError('ResourceLimit', 'The archive exceeds its processing budget')
    }
    this.totalBytes += member.byteSize
    this.members.add(member.path)
    this.namesBytes += Buffer.byteLength(member.path)
    const parts = member.path.split('/')
    for (let length = 1; length < parts.length; length += 1) {
      const parent = parts.slice(0, length).join('/')
      if (this.files.has(parent)) {
        throw new DesktopError('DataIntegrityError', 'An archive file is used as a directory')
      }
      if (!this.directories.has(parent)) {
        this.directories.add(parent)
        this.namesBytes += Buffer.byteLength(parent)
      }
      this.checkNames()
    }
    if (member.type === 'file') {
      if (this.directories.has(member.path)) {
        throw new DesktopError('DataIntegrityError', 'An archive directory is also a file')
      }
      this.files.add(member.path)
    } else {
      this.directories.add(member.path)
    }
    this.checkNames()
  }

  /** Bounds retained names, including inferred parent paths. */
  private checkNames(): void {
    if (this.namesBytes > this.limits.namesBytes) {
      throw new DesktopError('ResourceLimit', 'The archive contains too much path metadata')
    }
  }
}

/** Waits for one entry or the end marker without accumulating an archive-wide entry queue. */
function nextEntry(zip: InputZip): Promise<Entry | null> {
  return new Promise((resolve, reject) => {
    /** Removes the listeners belonging to this one directory read. */
    function cleanup(): void {
      zip.off('entry', entry)
      zip.off('end', end)
      zip.off('error', failure)
    }
    /** Delivers the one requested entry. */
    function entry(value: Entry): void {
      cleanup()
      resolve(value)
    }
    /** Delivers the actual end of the central directory. */
    function end(): void {
      cleanup()
      resolve(null)
    }
    /** Rejects this pending directory read. */
    function failure(error: unknown): void {
      cleanup()
      reject(error)
    }

    zip.once('entry', entry)
    zip.once('end', end)
    zip.once('error', failure)
    zip.readEntry()
  })
}

/** Waits until yauzl has released its file descriptor after all member streams have ended. */
async function closeArchive(zip: InputZip): Promise<void> {
  if (!zip.isOpen) {
    return
  }
  await new Promise<void>((resolve, reject) => {
    /** Completes descriptor cleanup and removes the paired failure listener. */
    function closed(): void {
      zip.off('error', failed)
      resolve()
    }
    /** Reports a descriptor cleanup failure and removes the paired close listener. */
    function failed(error: unknown): void {
      zip.off('close', closed)
      reject(error)
    }
    zip.once('close', closed)
    zip.once('error', failed)
    zip.close()
  })
}

/** Validates the declared member kind and strict UTF-8 names before any bytes are consumed. */
function memberValue(entry: Entry): ArchiveMember {
  if ((entry.generalPurposeBitFlag & 1) !== 0 || ![0, 8].includes(entry.compressionMethod)) {
    throw new DesktopError(
      'DataIntegrityError',
      'The archive uses unsupported encryption or compression',
    )
  }
  const directory = entry.fileName.endsWith('/')
  const kind = (entry.externalFileAttributes >>> 16) & 0o170000
  if (
    (kind !== 0 && kind !== (directory ? 0o040000 : 0o100000)) ||
    (directory && entry.uncompressedSize !== 0)
  ) {
    throw new DesktopError(
      'DataIntegrityError',
      'The archive contains a link or unsupported member kind',
    )
  }
  if ((entry.generalPurposeBitFlag & 0x800) !== 0) {
    new TextDecoder('utf-8', { fatal: true }).decode(entry.fileNameRaw)
  }
  for (const field of entry.extraFields) {
    if (
      field.id === 0x7075 &&
      field.data.length >= 5 &&
      field.data[0] === 1 &&
      field.data.readUInt32LE(1) === crc32(entry.fileNameRaw)
    ) {
      new TextDecoder('utf-8', { fatal: true }).decode(field.data.subarray(5))
    }
  }
  return {
    path: directory ? entry.fileName.slice(0, -1) : entry.fileName,
    type: directory ? 'directory' : 'file',
    byteSize: entry.uncompressedSize,
  }
}

/**
 * Reads complete members one at a time, verifying expanded lengths and CRC before success.
 *
 * The visitor consumes the complete supplied stream, including empty files. Paths are data only;
 * the owning business validates its manifest and destination filesystem before restoring content.
 */
export async function readArchive(
  path: string,
  limits: ArchiveLimits,
  visit: (member: ArchiveMember, data: Readable | null) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  const budget = new ArchiveBudget(limits)
  signal?.throwIfAborted()
  const zip = await openPromise(path, {
    autoClose: false,
    strictFileNames: true,
    validateEntrySizes: true,
  })
  let archiveFailure: unknown

  /** Retains an archive failure even while a member visitor owns the current asynchronous work. */
  function recordFailure(error: unknown): void {
    archiveFailure = error
  }
  zip.on('error', recordFailure)

  /** Closes the archive descriptor before releasing this operation's error observation. */
  async function dispose(): Promise<void> {
    try {
      await closeArchive(zip)
    } finally {
      zip.off('error', recordFailure)
    }
  }

  try {
    if (zip.fileSize > limits.archiveBytes) {
      throw new DesktopError('ResourceLimit', 'The archive file exceeds its byte budget')
    }
    while (true) {
      signal?.throwIfAborted()
      if (archiveFailure) {
        throw archiveFailure
      }
      const entry = await nextEntry(zip)
      if (!entry) {
        break
      }
      const member = memberValue(entry)
      budget.add(member)

      const source = await zip.openReadStreamPromise(entry)
      let bytes = 0
      let checksum = 0
      const verified = new Transform({
        /** Checks actual expanded bytes as they pass to the member consumer. */
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length
          checksum = crc32(chunk, checksum)
          callback(
            bytes > member.byteSize
              ? new DesktopError(
                  'DataIntegrityError',
                  'An archive member exceeds its declared size',
                )
              : null,
            chunk,
          )
        },
        /** Confirms complete content independently of ZIP's central-directory claims. */
        flush(callback) {
          callback(
            bytes === member.byteSize && checksum === entry.crc32
              ? null
              : new DesktopError(
                  'DataIntegrityError',
                  'An archive member failed its integrity check',
                ),
          )
        },
      })
      const transfer = pipeline(source, verified, { signal })
      void transfer.catch(() => {})
      try {
        if (member.type === 'directory') {
          verified.resume()
          await finished(verified, { cleanup: true })
        } else {
          await visit(member, verified)
        }
        if (!verified.readableEnded) {
          throw new Error('The archive visitor did not consume the complete member')
        }
        await transfer
        if (member.type === 'directory') {
          await visit(member, null)
        }
      } finally {
        source.destroy()
        verified.destroy()
        await Promise.allSettled([transfer, finished(source), finished(verified)])
      }
    }
  } catch (error) {
    try {
      await dispose()
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Archive reading and cleanup failed', {
        cause: cleanupError,
      })
    }
    throw error
  }
  await dispose()
}

/**
 * Creates a complete ZIP preparation from sequential, caller-owned input streams.
 *
 * ZIP64 is selected when required by the actual archive. Failure and cancellation end the current
 * stream and discard the owned output preparation; no user destination is replaced.
 * The input producer owns cancellation of the work needed to yield its next member.
 */
export async function createArchive(
  temporaryRoot: string,
  inputs: AsyncIterable<ArchiveInput> | Iterable<ArchiveInput>,
  native: NativeFiles,
  limits: ArchiveLimits,
  signal?: AbortSignal,
): Promise<StagedFile> {
  const budget = new ArchiveBudget(limits)
  const controller = new AbortController()
  const cancellation = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  cancellation.throwIfAborted()
  const output = new PassThrough()
  const zip = new ZipWriter(Writable.toWeb(output), {
    useWebWorkers: false,
    useCompressionStream: true,
    bufferedWrite: false,
    dataDescriptor: true,
    signal: cancellation,
  })
  const prepared = stageFile(temporaryRoot, output, native, limits.archiveBytes, cancellation)
  void prepared.catch((error: unknown) => controller.abort(error))
  try {
    for await (const input of inputs) {
      try {
        cancellation.throwIfAborted()
        budget.add({
          path: input.path,
          type: input.type,
          byteSize: input.type === 'file' ? input.byteSize : 0,
        })
        if (input.type === 'directory') {
          await zip.add(`${input.path}/`, undefined, { directory: true })
          continue
        }

        let bytes = 0
        const verified = new Transform({
          /** Rejects incorrect lengths while consuming the actual input stream. */
          transform(chunk: Buffer, _encoding, callback) {
            bytes += chunk.length
            callback(
              bytes > input.byteSize
                ? new DesktopError(
                    'DataIntegrityError',
                    'An archive input exceeds its declared size',
                  )
                : null,
              chunk,
            )
          },
          /** Rejects incomplete input before finalizing the member. */
          flush(callback) {
            callback(
              bytes === input.byteSize
                ? null
                : new DesktopError(
                    'DataIntegrityError',
                    'An archive input ended before its declared size',
                  ),
            )
          },
        })
        const transfer = pipeline(input.data, verified, { signal: cancellation })
        void transfer.catch((error: unknown) => controller.abort(error))
        try {
          // Node and DOM declarations describe the same native stream with different BYOB generics.
          const readable = Readable.toWeb(verified) as ReadableStream<Uint8Array>
          await zip.add(input.path, readable, {
            externalFileAttributes: (0o100600 << 16) >>> 0,
            uncompressedSize: input.byteSize,
          })
          await transfer
        } finally {
          input.data.destroy()
          verified.destroy()
          await Promise.allSettled([transfer, finished(input.data), finished(verified)])
        }
      } catch (error) {
        if (input.type === 'file') {
          input.data.destroy()
          await finished(input.data).catch(() => {})
        }
        throw error
      }
    }
    await zip.close()
    return await prepared
  } catch (error) {
    controller.abort(error)
    output.destroy(error instanceof Error ? error : new Error('Archive creation failed'))
    await Promise.allSettled([prepared])
    throw error
  }
}
