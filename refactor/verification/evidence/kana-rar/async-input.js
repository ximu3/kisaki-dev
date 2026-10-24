// Suspend the whole syscall so stream positions advance only after a completed read.
addToLibrary({
  fd_read__deps: ['$FS', '$SYSCALLS'],
  fd_read__async: 'auto',
  fd_read: async (fd, iov, iovcnt, result) => {
    try {
      const stream = SYSCALLS.getStreamFromFD(fd)
      let total = 0
      for (let index = 0; index < iovcnt; index++) {
        const pointer = HEAPU32[(iov + index * 8) >> 2]
        const requested = HEAPU32[(iov + index * 8 + 4) >> 2]
        if (!requested) continue
        const length = Math.min(requested, 65536)
        const chunk = await Module['hostRead'](stream.path, stream.position, length)
        if (!(chunk instanceof Uint8Array) || chunk.byteLength > length) {
          throw new Error('Invalid source range response')
        }
        // Asyncify may grow memory while unwinding; acquire the current heap after awaiting.
        HEAPU8.set(chunk, pointer)
        stream.position += chunk.byteLength
        total += chunk.byteLength
        if (chunk.byteLength < requested) break
      }
      HEAPU32[result >> 2] = total
      return 0
    } catch (error) {
      Module['inputFailed'] = true
      return 29
    }
  }
})
