/** @fileoverview Exposes one test identity query from a sandboxed preload. */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fixture', {
  /** Reads the fixture identity through the one permitted carrier IPC operation. */
  identity: () => ipcRenderer.invoke('fixture:identity'),
  sandboxed: process.sandboxed,
  isolated: process.contextIsolated,
})
