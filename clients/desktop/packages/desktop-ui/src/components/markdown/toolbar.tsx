/** @fileoverview The editor's format buttons share its live state, selection and keyboard tab stop. */

import { createMemo, createSignal, For, Show } from 'solid-js'
import type { JSX } from 'solid-js'
import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { redoDepth, undoDepth } from '@codemirror/commands'
import {
  mdiCodeTags,
  mdiFormatBold,
  mdiFormatHeader2,
  mdiFormatItalic,
  mdiFormatListBulleted,
  mdiFormatListChecks,
  mdiFormatListNumbered,
  mdiFormatQuoteClose,
  mdiFormatStrikethrough,
  mdiLinkVariant,
  mdiRedo,
  mdiUndo,
} from '@mdi/js'
import { createFocusNavigation } from '../../internal/focus'
import { Icon } from '../../internal/icon/glyph'
import { Tooltip, TooltipContent, TooltipTrigger } from '../tooltip/parts'
import { runMarkdownCommand } from './commands'
import type { MarkdownCommand } from './commands'
import styles from './styles.module.css'

const icons: Record<MarkdownCommand, string> = {
  bold: mdiFormatBold,
  italic: mdiFormatItalic,
  strike: mdiFormatStrikethrough,
  code: mdiCodeTags,
  heading: mdiFormatHeader2,
  bullet: mdiFormatListBulleted,
  ordered: mdiFormatListNumbered,
  quote: mdiFormatQuoteClose,
  task: mdiFormatListChecks,
  link: mdiLinkVariant,
  undo: mdiUndo,
  redo: mdiRedo,
}

const standardCommands = Object.freeze(Object.keys(icons) as MarkdownCommand[])

/** A host action runs against this mounted editor. IDs are unique within its toolbar. */
export interface MarkdownToolbarAction {
  id: string
  label: string
  icon: () => JSX.Element

  /** Set for actions such as opening a preview that also work on read-only source. */
  allowReadOnly?: boolean
  isEnabled?: (state: EditorState) => boolean
  run: (view: EditorView) => void
}

/** A command name uses the package's icon and editing behavior. */
export type MarkdownToolbarItem<C extends MarkdownCommand = MarkdownCommand> =
  C | MarkdownToolbarAction

/** Supply the complete order or derive it from the standard commands. An empty list hides the bar. */
export type MarkdownToolbarConfig<C extends MarkdownCommand = MarkdownCommand> =
  | readonly MarkdownToolbarItem<C>[]
  | ((standard: readonly MarkdownCommand[]) => readonly MarkdownToolbarItem<C>[])

interface ToolbarProps<C extends MarkdownCommand> {
  view: EditorView
  state: EditorState
  label: string
  commandLabel: ((command: C) => string) | undefined
  config: MarkdownToolbarConfig<C> | undefined
}

function commandAction<C extends MarkdownCommand>(
  command: C,
  label: (command: C) => string,
): MarkdownToolbarAction {
  return {
    id: command,
    get label() {
      return label(command)
    },
    icon: () => <Icon path={icons[command]} />,

    isEnabled: (state) => {
      if (command === 'undo') {
        return undoDepth(state) > 0
      }
      if (command === 'redo') {
        return redoDepth(state) > 0
      }

      return true
    },
    run: (view) => runMarkdownCommand(view, command),
  }
}

/** Pointer actions retain the text selection. Tab enters once and arrows follow the visible order. */
export function MarkdownToolbar<C extends MarkdownCommand>(props: ToolbarProps<C>): JSX.Element {
  let root!: HTMLDivElement
  const buttons = createMemo(() => {
    const config = props.config
    // Omitting the configuration requires a label provider for the entire standard set.
    const items =
      typeof config === 'function'
        ? config(standardCommands)
        : (config ?? (standardCommands as readonly C[]))

    const result = new Map<string, MarkdownToolbarAction>()
    for (const item of items) {
      const action = typeof item === 'string' ? commandAction(item, props.commandLabel!) : item
      result.set(action.id, action)
    }

    return result
  })

  const [focusedId, setFocusedId] = createSignal<string>()
  const enabled = createMemo(() => {
    const state = props.state
    return Array.from(buttons().values())
      .filter(
        (action) =>
          (!state.readOnly || action.allowReadOnly) && (action.isEnabled?.(state) ?? true),
      )
      .map((action) => action.id)
  })
  const tabStop = () => enabled().find((id) => id === focusedId()) ?? enabled()[0]
  const navigate = createFocusNavigation(
    () => root,
    'button',
    () => 'horizontal',
  )

  return (
    <Show when={buttons().size > 0}>
      <div
        ref={(node) => {
          root = node
        }}
        role="toolbar"
        aria-label={props.label}
        class={styles.toolbar}
        onKeyDown={navigate}
      >
        <For each={Array.from(buttons().keys())}>
          {(id) => {
            const action = () => buttons().get(id)!

            return (
              <Tooltip>
                <TooltipTrigger
                  class={styles.command}
                  size="icon"
                  variant="ghost"
                  aria-label={action().label}
                  disabled={!enabled().includes(id)}
                  tabIndex={tabStop() === id ? 0 : -1}
                  onFocus={() => setFocusedId(id)}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    const view = props.view
                    view.focus()
                    action().run(view)
                  }}
                >
                  {action().icon()}
                </TooltipTrigger>
                <TooltipContent>{action().label}</TooltipContent>
              </Tooltip>
            )
          }}
        </For>
      </div>
    </Show>
  )
}
