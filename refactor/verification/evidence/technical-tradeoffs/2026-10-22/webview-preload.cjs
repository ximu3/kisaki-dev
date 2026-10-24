const { contextBridge } = require('electron')

if (process.isMainFrame) {
  contextBridge.exposeInMainWorld('nativeProbe', { mainFrame: true })
}
