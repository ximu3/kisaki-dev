// Isolate native link metadata before exercising the browser resource owner.
import { open, stat } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { openArchive } from './archive.mjs'
const [build, fixture] = process.argv.slice(2)
const factory = (await import(pathToFileURL(join(build, 'unrar.mjs')).href)).default
const file = await open(fixture, 'r')
const source = {
  size: (await stat(fixture)).size,
  read: async (offset, length) => {
    const bytes = new Uint8Array(length)
    if (length && (await file.read(bytes, 0, length, offset)).bytesRead !== length)
      throw new Error('Incomplete source range')
    return bytes
  }
}
const archive = await openArchive(factory, source)
try {
  process.stdout.write(JSON.stringify(await archive.list()) + '\n')
} finally {
  await archive.dispose()
  await file.close()
}
