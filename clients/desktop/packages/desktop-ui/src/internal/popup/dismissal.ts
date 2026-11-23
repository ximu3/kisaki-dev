/** Connects outside pointer and platform close requests to the currently presented popup. */
export function watchPopupDismissal(
  panel: HTMLElement,
  anchor: HTMLElement,
  request: (restoreFocus: boolean) => void,
): () => void {
  const document = panel.ownerDocument
  const { CloseWatcher } = document.defaultView as Window & {
    CloseWatcher: new (options: { signal: AbortSignal }) => EventTarget
  }
  const lifetime = new AbortController()
  const { signal } = lifetime
  let outsidePointer: number | undefined

  function outside(event: PointerEvent) {
    const path = event.composedPath()
    return !path.includes(panel) && !path.includes(anchor)
  }

  document.addEventListener(
    'pointerdown',
    (event) => {
      outsidePointer = outside(event) ? event.pointerId : undefined
    },
    { capture: true, signal },
  )
  document.addEventListener(
    'pointerup',
    (event) => {
      const dismiss = outsidePointer === event.pointerId && outside(event)
      outsidePointer = undefined
      if (dismiss) {
        request(false)
      }
    },
    { capture: true, signal },
  )

  function watchClose() {
    const watcher = new CloseWatcher({ signal })
    watcher.addEventListener('cancel', (event) => {
      event.preventDefault()
      request(true)
    })
    watcher.addEventListener('close', () => {
      // A noncancelable platform request can end the watcher while the owner keeps the popup open.
      if (!signal.aborted) {
        watchClose()
      }
    })
  }
  watchClose()

  return () => lifetime.abort()
}
