/** @fileoverview One disclosure and presentation lifetime serves the trigger, listbox and virtual rows. */

import { createSignal, createUniqueId } from 'solid-js'
import { createPresentation } from '../popup/presentation'

/**
 * Creates shared disclosure identity, open state and exit-aware presence for one selection popup.
 */
export function createSelectionPopup() {
  const id = createUniqueId()
  /** Locally owned requested visibility of the selection popup. */
  const [open, setOpen] = createSignal(false)
  let node!: HTMLDivElement

  /** Returns the attached popup element for positioning and exit measurement. */
  const panel = () => node
  /** Presence reader retaining the popup surface through its exit transition. */
  const present = createPresentation(open, panel)
  /** Retains the mounted native popup element. */
  const attach = (element: HTMLDivElement) => {
    node = element
  }

  return { id, panelId: id + '-popup', open, setOpen, panel, present, attach }
}

/** Shared popup identity, element access and open and presentation state for selection parts. */
export type SelectionPopup = ReturnType<typeof createSelectionPopup>
