/** @fileoverview Track library modal ancestry for document-level interactive presentation. */

interface ModalHosts {
  stack: HTMLDialogElement[]
  listeners: Set<(host: HTMLDialogElement | undefined) => void>
}

const documents = new WeakMap<Document, ModalHosts>()

function hosts(document: Document): ModalHosts {
  let value = documents.get(document)
  if (!value) {
    value = { stack: [], listeners: new Set() }
    documents.set(document, value)
  }

  return value
}

/** Register after showModal and release before the dialog's content is removed. */
export function registerModal(node: HTMLDialogElement): () => void {
  const state = hosts(node.ownerDocument)
  const publish = () => state.listeners.forEach((listener) => listener(state.stack.at(-1)))
  state.stack.push(node)
  publish()

  return () => {
    state.stack.splice(state.stack.indexOf(node), 1)
    publish()
  }
}

/** Subscribe within the presentation host lifetime; moving DOM preserves its component owner. */
export function observeModalHost(
  document: Document,
  listener: (host: HTMLDialogElement | undefined) => void,
): () => void {
  const state = hosts(document)
  state.listeners.add(listener)
  listener(state.stack.at(-1))

  return () => state.listeners.delete(listener)
}
