import type { WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { receiveFile } from '../../infrastructure/files/input'
import { textArgument } from './values'

export function openDocumentFileInputs(contents: WebContents, canReceive: () => boolean) {
  const fileInputs = new Map<string, ReturnType<typeof receiveFile>>()

  const receiveInput = (event: Electron.IpcMainEvent) => {
    const port = event.ports[0]
    if (!port) {
      return
    }
    if (!canReceive() || event.senderFrame !== contents.mainFrame || fileInputs.size >= 32) {
      port.close()
      return
    }
    const id = randomUUID()
    const stream = receiveFile(port)
    fileInputs.set(id, stream)
    stream.once('close', () => fileInputs.delete(id))
    port.postMessage({ id })
  }
  contents.ipc.on('kisaki-file-input', receiveInput)

  async function consume<T>(
    id: unknown,
    read: (input: ReturnType<typeof receiveFile>) => Promise<T>,
  ) {
    const key = textArgument(id)
    const stream = fileInputs.get(key)
    if (!stream) {
      throw new DesktopError('InvalidReference', 'The file input is unavailable')
    }
    fileInputs.delete(key)
    try {
      return await read(stream)
    } finally {
      stream.destroy()
    }
  }

  return {
    consume,
    close() {
      contents.ipc.off('kisaki-file-input', receiveInput)
      for (const input of fileInputs.values()) {
        input.destroy()
      }
      fileInputs.clear()
    },
  }
}

export type DocumentFileInputs = ReturnType<typeof openDocumentFileInputs>
