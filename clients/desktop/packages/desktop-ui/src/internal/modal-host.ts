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

export function restoringModalFocus(document: Document): boolean {
  return documents.get(document)?.stack.at(-1)?.open === false
}

export function observeModalHost(
  document: Document,
  listener: (host: HTMLDialogElement | undefined) => void,
): () => void {
  const state = hosts(document)
  state.listeners.add(listener)
  listener(state.stack.at(-1))

  return () => state.listeners.delete(listener)
}
