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

/** Host action applied to the mounted editor, identified uniquely within its toolbar. */
export interface MarkdownToolbarAction {
  id: string
  label: string
  /** Renders the action's decorative toolbar icon. */
  icon: () => JSX.Element

  /** Set for actions such as opening a preview that also work on read-only source. */
  allowReadOnly?: boolean
  /** Checks action availability against the current editor state. */
  isEnabled?: (state: EditorState) => boolean
  /** Executes the action against the current mounted editor view. */
  run: (view: EditorView) => void
}

/** Built-in formatting command or fully described host toolbar action. */
export type MarkdownToolbarItem<C extends MarkdownCommand = MarkdownCommand> =
  C | MarkdownToolbarAction

/**
 * Complete toolbar order or a factory deriving it from standard commands.
 *
 * An empty result hides the toolbar.
 */
export type MarkdownToolbarConfig<C extends MarkdownCommand = MarkdownCommand> =
  | readonly MarkdownToolbarItem<C>[]
  | ((standard: readonly MarkdownCommand[]) => readonly MarkdownToolbarItem<C>[])

/** Live editor state, localized labels and optional toolbar composition. */
interface ToolbarProps<C extends MarkdownCommand> {
  view: EditorView
  state: EditorState
  label: string
  /** Returns the current localized label for a built-in toolbar command. */
  commandLabel: ((command: C) => string) | undefined
  /** Provides or derives the complete toolbar order; undefined uses the standard command set. */
  config: MarkdownToolbarConfig<C> | undefined
}

/** Adapts a built-in command to a labeled action with its package icon and history availability. */
function commandAction<C extends MarkdownCommand>(
  command: C,
  label: (command: C) => string,
): MarkdownToolbarAction {
  return {
    id: command,
    /** Reads the current localized label for the built-in command. */
    get label() {
      return label(command)
    },
    /** Renders the package-owned glyph for the built-in command. */
    icon: () => <Icon path={icons[command]} />,

    /** Checks undo or redo availability while leaving ordinary formatting commands enabled. */
    isEnabled: (state) => {
      if (command === 'undo') {
        return undoDepth(state) > 0
      }
      if (command === 'redo') {
        return redoDepth(state) > 0
      }

      return true
    },
    /** Applies the built-in command to the supplied live editor. */
    run: (view) => runMarkdownCommand(view, command),
  }
}

/**
 * Renders formatting actions with one tab entry and arrow navigation in visible order.
 *
 * Pointer activation preserves the editor's text selection.
 */
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
  /**
   * Chooses the remembered enabled action or the first available action as the toolbar's tab entry.
   */
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
            /** Reads current action data for the stable toolbar item identity. */
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
