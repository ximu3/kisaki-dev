/** @fileoverview Pulls bounded binary chunks from a file dropped or pasted into the owning document. */

import type { MessagePortMain } from 'electron'
import { Readable } from 'node:stream'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { fileChunkBytes } from '../../../shared/window-api/protocol'

/** Claims each chunk only after the file consumer asks for more, and closes the port on cancellation. */
export function receiveFile(port: MessagePortMain) {
  let requested = false
  let ended = false
  const stream = new Readable({
    highWaterMark: fileChunkBytes,
    /** Requests the next bounded chunk only when the file pipeline has capacity. */
    read() {
      if (!requested && !ended) {
        requested = true
        port.postMessage('read')
      }
    },
    /** Closes the binary transfer and delivers its final stream error. */
    destroy(error, done) {
      ended = true
      port.close()
      done(error)
    },
  })
  port.on('message', (event) => {
    if (!requested || ended) {
      stream.destroy(new DesktopError('ProtocolViolation', 'Unexpected file chunk'))
      return
    }
    requested = false
    if (event.data === null) {
      ended = true
      stream.push(null)
      return
    }
    if (
      !(event.data instanceof Uint8Array) ||
      !event.data.byteLength ||
      event.data.byteLength > fileChunkBytes
    ) {
      stream.destroy(new DesktopError('InvalidInput', 'Invalid file chunk'))
      return
    }
    stream.push(Buffer.from(event.data.buffer, event.data.byteOffset, event.data.byteLength))
  })
  port.once('close', () => {
    if (!ended) {
      stream.destroy(new DesktopError('ConnectionClosed', 'The file input closed'))
    }
  })
  // The document can release an input before a preparation pipeline starts listening.
  stream.on('error', () => {})
  port.start()
  return stream
}
