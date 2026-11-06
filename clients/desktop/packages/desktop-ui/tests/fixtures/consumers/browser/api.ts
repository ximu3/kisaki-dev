/** @fileoverview Test-owned controls for external updates and resource-lifetime observations. */

export interface FixtureApi {
  setExternal: (value: string) => void
  setOptions: () => void
  setLongMessage: (language: string) => void

  setOwner: (mounted: boolean) => void
  showLoading: (persistent: boolean) => void
  updateToast: () => void
  dismissToast: () => void
  rootToast: () => void

  editorText?: () => string
  editorSet?: (value: string) => void
  editorSelect?: () => void
  editorReleased?: boolean
  format?: (command: 'bold' | 'undo') => void

  dispose: () => void
}

declare global {
  interface Window {
    fixture: FixtureApi
  }
}
