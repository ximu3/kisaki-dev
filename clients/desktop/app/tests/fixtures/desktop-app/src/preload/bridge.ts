import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fixture', {
  identity: () => ipcRenderer.invoke('fixture:identity'),
  ping: () => ipcRenderer.invoke('fixture:ping'),
  sandboxed: process.sandboxed,
  isolated: process.contextIsolated,
})
