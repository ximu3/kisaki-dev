/** @fileoverview CodeMirror source editing with reactive configuration and explicit view lifetime. */

import { createEffect, createSignal, onCleanup, onMount, Show, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { Compartment, EditorState, Transaction } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { assignRef, classes } from '../../internal/dom'
import type { MarkdownCommand } from './commands'
import styles from './styles.module.css'
import { editorTheme } from './theme'
import { MarkdownToolbar } from './toolbar'
import type { MarkdownToolbarConfig } from './toolbar'

const highlighting = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--primary)', fontWeight: '600' },
  { tag: tags.link, color: 'var(--primary)', textDecoration: 'underline' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, color: 'var(--foreground)', fontFamily: 'var(--font-mono)' },
  { tag: tags.meta, color: 'var(--muted-foreground)' },
])

/**
 * Shared source-editor values, configuration and borrowed-view lifecycle callbacks.
 *
 * The host owns text persistence and save policy.
 */
interface EditorProps<C extends MarkdownCommand> extends Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'children'
> {
  value?: string
  defaultValue?: string
  /** Reports document changes outside external-value synchronization. */
  onValueChange?: (value: string) => void

  label: string
  placeholder?: string
  readOnly?: boolean
  /** Selects toolbar items directly or derives them from the standard command list. */
  toolbar?: MarkdownToolbarConfig<C> | undefined
  /** Defaults to the editor's localized accessible name. */
  toolbarLabel?: string
  /** Returns the localized accessible label for a displayed built-in command. */
  commandLabel?: (command: NoInfer<C>) => string

  extensions?: Extension
  /**
   * Publishes the mounted editor and reports undefined when it is released.
   *
   * The component retains ownership of the borrowed view.
   */
  onViewChange?: (view: EditorView | undefined) => void
  cspNonce?: string
}

/**
 * Editor props coupling displayed built-in commands to their required localized labels.
 *
 * Custom-only and empty toolbars carry their own names.
 */
export type MarkdownEditorProps<C extends MarkdownCommand = MarkdownCommand> = EditorProps<C> &
  (
    | {
        /** Provides a custom-only or empty toolbar without requiring built-in command labels. */
        toolbar: MarkdownToolbarConfig<never>
      }
    | ({
        /** Returns labels for the built-in commands permitted by this toolbar configuration. */
        commandLabel: (command: NoInfer<C>) => string
      } & ([MarkdownCommand] extends [C]
        ? unknown
        : {
            /**
             * Selects or derives items from the declared subset of built-in commands and custom
             * actions.
             */
            toolbar: MarkdownToolbarConfig<C>
          }))
  )

/**
 * Creates and owns one CodeMirror source-editing view.
 *
 * External value updates wait for composition and do not add undo steps. Owner cleanup destroys the
 * view and invalidates its borrowed reference.
 */
export function MarkdownEditor<C extends MarkdownCommand = MarkdownCommand>(
  input: MarkdownEditorProps<C>,
): JSX.Element {
  const props: EditorProps<C> = input
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'label',
    'placeholder',
    'readOnly',
    'toolbarLabel',
    'commandLabel',
    'toolbar',
    'extensions',
    'onViewChange',
    'cspNonce',
    'class',
    'ref',
  ])

  let parent!: HTMLDivElement
  let view!: EditorView
  const [state, setState] = createSignal<EditorState>()

  onMount(() => {
    const configuration = new Compartment()
    let synchronizing = false
    let alive = true
    /** Builds reactive readonly, accessibility, placeholder and host-extension configuration. */
    const extension = () => [
      EditorState.readOnly.of(!!local.readOnly),
      EditorView.editable.of(!local.readOnly),
      EditorView.contentAttributes.of({ 'aria-label': local.label }),
      placeholder(local.placeholder ?? ''),
      local.extensions ?? [],
    ]

    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: local.value ?? local.defaultValue ?? '',
        extensions: [
          editorTheme,
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          syntaxHighlighting(highlighting),
          EditorView.lineWrapping,
          EditorView.cspNonce.of(local.cspNonce ?? ''),
          configuration.of(extension()),
          EditorView.updateListener.of((update) => {
            setState(update.state)
            if (update.docChanged && !synchronizing) {
              local.onValueChange?.(update.state.doc.toString())
            }
          }),
        ],
      }),
    })
    setState(view.state)

    /**
     * Adopts changed external text after composition without reporting it as an editor-originated
     * change or adding history.
     */
    const sync = () => {
      if (
        !alive ||
        view.composing ||
        local.value === undefined ||
        local.value === view.state.doc.toString()
      ) {
        return
      }

      synchronizing = true
      try {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: local.value },
          annotations: Transaction.addToHistory.of(false),
        })
      } finally {
        synchronizing = false
      }
    }

    /** Schedules controlled-value synchronization after native composition settles. */
    const compositionEnd = () => queueMicrotask(sync)
    view.contentDOM.addEventListener('compositionend', compositionEnd)
    createEffect(sync)
    createEffect(() => view.dispatch({ effects: configuration.reconfigure(extension()) }))
    local.onViewChange?.(view)

    onCleanup(() => {
      alive = false
      view.contentDOM.removeEventListener('compositionend', compositionEnd)
      view.destroy()
      local.onViewChange?.(undefined)
    })
  })

  return (
    <div
      {...rest}
      ref={(node) => assignRef(local.ref, node)}
      class={classes(styles.editor, local.class)}
    >
      <Show when={state()}>
        {(current) => (
          <MarkdownToolbar
            view={view}
            state={current()}
            label={local.toolbarLabel ?? local.label}
            commandLabel={local.commandLabel}
            config={local.toolbar}
          />
        )}
      </Show>
      <div
        class={styles.source}
        ref={(node) => {
          parent = node
        }}
      />
    </div>
  )
}
