/** @fileoverview Keyboard-accessible Markdown actions sharing the editor's transactions. */

import { createEffect, createSignal, For, onCleanup } from 'solid-js'
import type { JSX } from 'solid-js'
import type { EditorView } from '@codemirror/view'
import { Button } from '../button/control'
import { createFocusNavigation } from '../../internal/focus'
import { runMarkdownCommand } from './commands'
import type { MarkdownCommand } from './commands'
import styles from './styles.module.css'

const defaultCommands: readonly MarkdownCommand[] = [
  'bold',
  'italic',
  'strike',
  'code',
  'heading',
  'bullet',
  'ordered',
  'quote',
  'task',
  'link',
  'undo',
  'redo',
]

/** labels and toolbar name come from the host; view is borrowed only for its mounted lifetime. */
export interface MarkdownToolbarProps {
  view: EditorView | undefined
  label: string
  labels: Readonly<Record<MarkdownCommand, string>>
  commands?: readonly MarkdownCommand[]
  /** Disable commands for additional host-owned reasons. The view owns its read-only state. */
  disabled?: boolean
}

/** Prevent pointer focus transfer so a click formats the editor's existing selection. */
export function MarkdownToolbar(props: MarkdownToolbarProps): JSX.Element {
  let root!: HTMLDivElement
  const [readOnly, setReadOnly] = createSignal(true)

  createEffect(() => {
    const view = props.view
    setReadOnly(!view || view.state.readOnly)

    if (view) {
      // CodeMirror reflects read-only changes on its public content DOM, including full state replacements.
      const observer = new MutationObserver(() => setReadOnly(view.state.readOnly))
      observer.observe(view.contentDOM, { attributes: true, attributeFilter: ['aria-readonly'] })
      onCleanup(() => observer.disconnect())
    }
  })

  const navigate = createFocusNavigation(
    () => root,
    'button',
    () => 'horizontal',
  )

  return (
    <div
      ref={(node) => {
        root = node
      }}
      role="toolbar"
      aria-label={props.label}
      class={styles.toolbar}
      onKeyDown={navigate}
    >
      <For each={props.commands ?? defaultCommands}>
        {(command) => (
          <Button
            size="sm"
            variant="ghost"
            disabled={props.disabled || readOnly()}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => {
              if (props.view) {
                runMarkdownCommand(props.view, command)
              }
            }}
          >
            {props.labels[command]}
          </Button>
        )}
      </For>
    </div>
  )
}
