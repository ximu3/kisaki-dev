/** @fileoverview One disclosure and presentation lifetime serves the trigger, listbox and virtual rows. */

import { createSignal, createUniqueId } from 'solid-js'
import { createPresentation } from '../popup/presentation'

export function createSelectionPopup() {
  const id = createUniqueId()
  const [open, setOpen] = createSignal(false)
  let node!: HTMLDivElement

  const panel = () => node
  const present = createPresentation(open, panel)
  const attach = (element: HTMLDivElement) => {
    node = element
  }

  return { id, panelId: id + '-popup', open, setOpen, panel, present, attach }
}

export type SelectionPopup = ReturnType<typeof createSelectionPopup>
