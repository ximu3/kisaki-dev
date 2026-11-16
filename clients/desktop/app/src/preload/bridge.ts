/** @fileoverview Transfers the bound native port only to the top-level document in this sandboxed window. */

import { ipcRenderer } from 'electron'
import type { WindowKind } from '../shared/window-api/protocol'

/** Establishes the native channel after the document installs its message receiver. */
export function connectWindow(kind: WindowKind) {
  if (!process.isMainFrame) {
    return
  }
  /** Consume only this document's port request; dev tooling may also post ordinary window messages. */
  function requestPort(event: MessageEvent) {
    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      event.data !== 'kisaki-connect'
    ) {
      return
    }
    window.removeEventListener('message', requestPort)
    ipcRenderer.send('kisaki-connect', kind)
  }
  window.addEventListener('message', requestPort)
  if (kind === 'main') {
    window.addEventListener('message', (event) => {
      if (
        event.source === window &&
        event.origin === location.origin &&
        event.data === 'kisaki-file-input' &&
        event.ports.length === 1
      ) {
        ipcRenderer.postMessage('kisaki-file-input', null, [event.ports[0]!])
      }
    })
  }
  ipcRenderer.once('kisaki-port', (event) => {
    window.postMessage('kisaki-port', window.location.origin, event.ports)
  })
}
