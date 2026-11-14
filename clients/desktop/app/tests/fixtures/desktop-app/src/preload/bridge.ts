/** @fileoverview Exposes identity and main-thread responsiveness from a sandboxed preload. */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fixture', {
  /** Reads the fixture identity over the carrier IPC channel. */
  identity: () => ipcRenderer.invoke('fixture:identity'),
  /** Waits for main to service an IPC request while the database worker is busy. */
  ping: () => ipcRenderer.invoke('fixture:ping'),
  sandboxed: process.sandboxed,
  isolated: process.contextIsolated,
})
