/** @fileoverview Places each editor's form in the scrolling body and its actions in the same dialog's footer. */

import { createContext, createSignal, Show, useContext, type Accessor, type JSX } from 'solid-js'
import { Portal } from 'solid-js/web'
import { DialogBody, DialogFooter } from '@kisaki3/desktop-ui/dialog'

/** Target owned by one mounted dialog, including a manager above another open editor. */
const FooterTarget = createContext<Accessor<HTMLElement | undefined>>()

/** Provides a sibling footer destination outside this dialog's scrolling body. */
export function EditorBody(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [target, setTarget] = createSignal<HTMLElement>()
  return (
    <FooterTarget.Provider value={target}>
      <DialogBody {...props} />
      <div ref={setTarget} class="editor-footer-slot" />
    </FooterTarget.Provider>
  )
}

/** Keeps actions owned by their editor while the submit button uses its native form association. */
export function EditorFooter(props: { children: JSX.Element }) {
  const target = useContext(FooterTarget)!
  return (
    <Show when={target()}>
      {(element) => (
        <Portal mount={element()}>
          <DialogFooter class="editor-footer">{props.children}</DialogFooter>
        </Portal>
      )}
    </Show>
  )
}
