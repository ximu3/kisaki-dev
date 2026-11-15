/** @fileoverview Transfers the test window's dedicated port across its isolated preload. */

import { ipcRenderer } from 'electron'

ipcRenderer.once('fixture-port', (event) => {
  window.postMessage('fixture-port', '*', event.ports)
})
