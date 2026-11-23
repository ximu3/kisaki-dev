import { createSignal, createUniqueId } from 'solid-js'
import { createPresentation } from '../../internal/popup/presentation'

/**
 * Creates shared disclosure identity, open state and exit-aware presence for one selection popup.
 */
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

/** Shared popup identity, element access and open and presentation state for selection parts. */
export type SelectionPopup = ReturnType<typeof createSelectionPopup>
