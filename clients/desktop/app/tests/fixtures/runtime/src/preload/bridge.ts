/** @fileoverview Exposes one test identity query from a sandboxed preload. */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fixture', {
  identity: () => ipcRenderer.invoke('fixture:identity'),
  sandboxed: process.sandboxed,
  isolated: process.contextIsolated,
})
