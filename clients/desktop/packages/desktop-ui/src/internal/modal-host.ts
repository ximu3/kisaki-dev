/** @fileoverview Tracks library modal ancestry for document-level interactive presentation. */

/** Active library modal stack and presentation listeners owned by one document. */
interface ModalHosts {
  stack: HTMLDialogElement[]
  listeners: Set<(host: HTMLDialogElement | undefined) => void>
}

/** Document-scoped modal hosts shared by overlays and persistent feedback surfaces. */
const documents = new WeakMap<Document, ModalHosts>()

/** Returns the document's existing modal registry or creates its empty registry. */
function hosts(document: Document): ModalHosts {
  let value = documents.get(document)
  if (!value) {
    value = { stack: [], listeners: new Set() }
    documents.set(document, value)
  }

  return value
}

/**
 * Registers an active modal at the top of its document stack and returns a one-time release
 * callback.
 *
 * Callers register after showModal and release before the dialog's content is removed.
 */
export function registerModal(node: HTMLDialogElement): () => void {
  const state = hosts(node.ownerDocument)
  /** Notifies listeners of the document's current top modal, if any. */
  const publish = () => state.listeners.forEach((listener) => listener(state.stack.at(-1)))
  state.stack.push(node)
  publish()

  return () => {
    state.stack.splice(state.stack.indexOf(node), 1)
    publish()
  }
}

/**
 * Subscribes to modal-host changes and immediately delivers the current host.
 *
 * The caller releases the subscription with its presentation host.
 */
export function observeModalHost(
  document: Document,
  listener: (host: HTMLDialogElement | undefined) => void,
): () => void {
  const state = hosts(document)
  state.listeners.add(listener)
  listener(state.stack.at(-1))

  return () => state.listeners.delete(listener)
}
