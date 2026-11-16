/** @fileoverview Transfers a selected browser File with bounded reads through a document-owned binary port. */

import { fileChunkBytes } from '../../shared/window-api/protocol'

/** Receives the host's input reference without reading any bytes until the preparation requests them. */
export async function fileInput(file: File) {
  const channel = new MessageChannel()
  const ready = Promise.withResolvers<string>()
  let offset = 0
  let opened = false
  channel.port1.onmessage = (event: MessageEvent<unknown>) => {
    if (
      !opened &&
      event.data &&
      typeof event.data === 'object' &&
      'id' in event.data &&
      typeof event.data.id === 'string'
    ) {
      opened = true
      ready.resolve(event.data.id)
      return
    }
    if (event.data === 'read') {
      if (offset === file.size) {
        channel.port1.postMessage(null)
      } else {
        const chunk = file.slice(offset, offset + fileChunkBytes)
        offset += chunk.size
        void chunk
          .arrayBuffer()
          .then((bytes) => channel.port1.postMessage(new Uint8Array(bytes)))
          .catch(() => channel.port1.close())
      }
    }
  }
  channel.port1.addEventListener('close', () =>
    ready.reject(new Error('The file input was closed')),
  )
  channel.port1.onmessageerror = () => channel.port1.close()
  window.postMessage('kisaki-file-input', location.origin, [channel.port2])
  try {
    return {
      id: await ready.promise,
      /** Closes this document's source port after preparation finishes. */
      dispose: () => channel.port1.close(),
    }
  } catch (error) {
    channel.port1.close()
    throw error
  }
}
