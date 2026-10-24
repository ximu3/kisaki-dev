// Snapshot admission specimen: sequential temporary writes or bounded retained bytes.
async function snapshotStream(stream, storage, memoryLimit) {
  const reader = stream.getReader()
  const signal = new AbortController().signal
  const chunks = []
  let file
  let size = 0
  let peakRetained = 0
  try {
    if (storage) file = await storage.create(signal)
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      if (file) await file.write(size, value, signal)
      else {
        if (size + value.byteLength > memoryLimit) {
          throw Object.assign(new Error('The snapshot exceeded its retained-byte budget.'), {
            reason: 'resourceLimit'
          })
        }
        chunks.push(value.slice())
        peakRetained = Math.max(peakRetained, size + value.byteLength)
      }
      size += value.byteLength
    }
    return {
      size,
      peakRetained,
      async dispose() {
        chunks.length = 0
        await file?.dispose()
      }
    }
  } catch (cause) {
    const cleanup = await Promise.allSettled([reader.cancel(), file?.dispose()])
    chunks.length = 0
    if (cleanup.some((result) => result.status === 'rejected')) {
      throw Object.assign(new Error('Snapshot cleanup failed.', { cause }), {
        reason: 'readFailed'
      })
    }
    throw cause
  } finally {
    reader.releaseLock()
  }
}
globalThis.snapshotStream = snapshotStream
