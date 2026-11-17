/** @fileoverview Shares an editor's in-flight save across its form, shortcut and close confirmation. */

import { createSignal } from 'solid-js'

/** Keeps the editor interactive while all callers await the same submitted operation. */
export function createSubmission<A extends unknown[]>(commit: (...args: A) => Promise<void>) {
  const [busy, setBusy] = createSignal(false)
  let pending: Promise<void> | undefined

  /** Captures values in the commit before returning to the event loop. */
  function save(...args: A) {
    if (!pending) {
      setBusy(true)
      pending = commit(...args).finally(() => {
        pending = undefined
        setBusy(false)
      })
    }
    return pending
  }

  return { busy, save }
}
