import { open, opendir, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { openPromise } from 'yauzl'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { ReadingFileMetadata } from '@kisaki3/desktop-contracts/library'

export const pictureName = /\.(?:jpe?g|png|gif|webp|avif|bmp|svg)$/iu
export async function fileHeader(path: string) {
  const file = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(8192)
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await file.close()
  }
}

function picture(bytes: Buffer) {
  return (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
    /^GIF8[79]a|^BM/u.test(bytes.toString('ascii', 0, 6)) ||
    (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') ||
    (bytes.toString('ascii', 4, 8) === 'ftyp' &&
      /avif|avis/u.test(bytes.toString('ascii', 8, 40))) ||
    /^(?:\s*<\?xml[^>]*\?>)?\s*<svg(?:\s|>)/u.test(bytes.toString('utf8'))
  )
}

export async function inspectBook(
  path: string,
  signal: AbortSignal,
): Promise<{ kind: 'file' | 'directory'; metadata: ReadingFileMetadata }> {
  const file = await stat(path)
  if (file.isDirectory()) {
    let pages = 0
    for await (const entry of await opendir(path)) {
      signal.throwIfAborted()
      if (
        entry.isFile() &&
        pictureName.test(entry.name) &&
        picture(await fileHeader(join(path, entry.name)))
      ) {
        pages++
      }
    }
    if (!pages) {
      throw new DesktopError('InvalidInput', 'The directory contains no readable image pages')
    }
    return { kind: 'directory', metadata: { format: 'images', pageCount: pages } }
  }
  if (!file.isFile()) {
    throw new DesktopError('InvalidInput', 'Choose a book file or a directory of pages')
  }
  const bytes = await fileHeader(path)
  if (bytes.subarray(0, 6).equals(Buffer.from([82, 97, 114, 33, 26, 7]))) {
    throw new DesktopError('UnsupportedFormat', 'RAR is not a supported reading container')
  }
  let format: ReadingFileMetadata['format'],
    pageCount: number | null = null
  if (bytes.toString('ascii', 0, 5) === '%PDF-') {
    format = 'pdf'
  } else if (bytes.toString('ascii', 60, 68) === 'BOOKMOBI') {
    format = 'mobi'
  } else if (bytes.toString('ascii', 0, 2) === 'PK') {
    const archive = await openPromise(path, { autoClose: false })
    let container = false,
      pages = 0
    try {
      for await (const member of archive.eachEntry()) {
        signal.throwIfAborted()
        if (member.fileName === 'META-INF/container.xml') {
          container = true
        }
        if (pictureName.test(member.fileName)) {
          pages++
        }
      }
    } finally {
      archive.close()
    }
    if (container) {
      format = 'epub'
    } else if (pages) {
      format = 'images'
      pageCount = pages
    } else {
      throw new DesktopError('InvalidInput', 'The archive contains no supported book')
    }
  } else {
    const content = bytes.toString(bytes[0] === 255 && bytes[1] === 254 ? 'utf16le' : 'utf8')
    if (/^(?:\uFEFF?\s*<\?xml[^>]*\?>)?\s*<(?:[\w-]+:)?FictionBook(?:\s|>)/u.test(content)) {
      format = 'fb2'
    } else if (extname(path).toLowerCase() === '.txt' && !content.includes('\0')) {
      format = 'txt'
    } else {
      throw new DesktopError('InvalidInput', 'The file is not a supported reading target')
    }
  }
  signal.throwIfAborted()
  return { kind: 'file', metadata: { format, pageCount } }
}
