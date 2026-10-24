import type { WindowControls } from '../shared/window-controls'

declare global {
  interface Window {
    readonly kisaki: WindowControls
  }
}
