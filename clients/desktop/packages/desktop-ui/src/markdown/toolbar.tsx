/** @fileoverview Host-localized editing actions for a mounted MarkdownEditor. */

import { For, type JSX } from 'solid-js'
import type { EditorView } from '@codemirror/view'
import { Button } from '../button'
import { runMarkdownCommand, type MarkdownCommand } from './commands'

export interface MarkdownToolbarProps {
  label: string
  view: EditorView | undefined
  actions: readonly { command: MarkdownCommand; label: string; icon?: JSX.Element }[]
}

/** Restore editor focus after a formatting action without losing the selection. */
export function MarkdownToolbar(props: MarkdownToolbarProps): JSX.Element {
  return (
    <div role="group" aria-label={props.label} class="flex flex-wrap gap-0.5">
      <For each={props.actions}>
        {(action) => (
          <Button
            size="sm"
            variant="ghost"
            disabled={!props.view}
            aria-label={action.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (props.view) {
                runMarkdownCommand(props.view, action.command)
                props.view.focus()
              }
            }}
          >
            {action.icon ?? action.label}
          </Button>
        )}
      </For>
    </div>
  )
}
