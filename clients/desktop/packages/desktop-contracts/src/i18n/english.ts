/** @fileoverview Owns the English source messages used by the implemented desktop window shell. */

import type { MessageCatalog } from './catalog'

/** The authoritative current English catalog; product features extend it together with their actual UI. */
export const englishMessages = {
  windows: { main: 'Kisaki', reader: 'Reader', player: 'Player', gamePanel: 'Game panel' },
  window: { close: 'Close window', closeFailed: 'This window could not be closed.' },
} as const satisfies MessageCatalog
