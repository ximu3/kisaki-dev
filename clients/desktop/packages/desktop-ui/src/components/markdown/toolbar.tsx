/** @fileoverview Keyboard-accessible Markdown actions sharing the editor's transactions. */

import { For } from 'solid-js'
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
  /** Pass the host's changing read-only or operation-availability state. */
  disabled?: boolean
}

/** Prevent pointer focus transfer so a click formats the editor's existing selection. */
export function MarkdownToolbar(props: MarkdownToolbarProps): JSX.Element {
  let root!: HTMLDivElement
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
            disabled={props.disabled || !props.view || props.view.state.readOnly}
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
