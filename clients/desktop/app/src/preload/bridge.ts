import { ipcRenderer } from 'electron'
import type { WindowKind } from '../shared/window-api/protocol'

export function connectWindow(kind: WindowKind) {
  if (!process.isMainFrame) {
    return
  }

  function entryFailed(event: Event) {
    if (event.target instanceof HTMLScriptElement && event.target.type === 'module') {
      ipcRenderer.send('kisaki-entry-failed')
    }
  }
  window.addEventListener('error', entryFailed, true)

  function requestPort(event: MessageEvent) {
    // Dev tooling also posts window messages, independent of the port request.
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
    window.removeEventListener('error', entryFailed, true)
    window.postMessage('kisaki-port', window.location.origin, event.ports)
  })
}
