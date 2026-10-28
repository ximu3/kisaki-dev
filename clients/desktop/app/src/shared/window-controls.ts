/**
 * @fileoverview Defines window kinds and the minimal controls exposed through each
 * isolated preload bridge.
 */

/** Native document kinds, each with its own renderer and sandboxed preload entry. */
export type WindowKind = 'main' | 'reader' | 'player' | 'game-panel'

/** Window-local controls; the main process derives the actual owner from the sender. */
export interface WindowControls {
  readonly kind: WindowKind
  /** Request normal closure of the window that owns this bridge. */
  close(): Promise<void>
}
