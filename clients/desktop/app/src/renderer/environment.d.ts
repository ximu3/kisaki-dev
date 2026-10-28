/** @fileoverview Connects renderer window types to the private preload control contract. */

import type { WindowControls } from '../shared/window-controls'

declare global {
  interface Window {
    readonly kisaki: WindowControls
  }
}
