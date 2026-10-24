import { contextBridge, ipcRenderer } from 'electron'
import type { WindowControls, WindowKind } from '../shared/window-controls'

/** Expose this window's controls through contextBridge and forward renderer readiness. */
export function exposeWindowControls(kind: WindowKind): void {
  window.addEventListener('kisaki:renderer-ready', () => ipcRenderer.send('window:ready'), {
    once: true,
  })

  const controls: WindowControls = {
    kind,
    close: () => ipcRenderer.invoke('window:close'),
  }

  contextBridge.exposeInMainWorld('kisaki', Object.freeze(controls))
}
