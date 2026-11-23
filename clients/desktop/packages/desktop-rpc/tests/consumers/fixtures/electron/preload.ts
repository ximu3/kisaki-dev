import { ipcRenderer } from 'electron'

ipcRenderer.once('fixture-port', (event) => {
  window.postMessage('fixture-port', '*', event.ports)
})
