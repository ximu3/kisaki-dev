import { createEffect, createSignal, onSettled, Show, omit } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { Compartment, EditorState, Transaction, type Extension } from '@codemirror/state'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { MarkdownCommand } from './commands'
import styles from './styles.module.css'
import { editorTheme } from './theme'
import { MarkdownToolbar, type MarkdownToolbarConfig } from './toolbar'

/** CodeMirror syntax color and emphasis rules resolved through host appearance tokens. */
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
  const rest = omit(
    props,
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
  )

  let parent!: HTMLDivElement
  let view!: EditorView
  const [state, setState] = createSignal<EditorState>()

  const configuration = new Compartment()
  let synchronizing = false
  let alive = true
  let scheduled = false

  function scheduleSync() {
    if (scheduled) {
      return
    }
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      sync()
    })
  }

  const extension = () => [
    EditorState.readOnly.of(!!props.readOnly),
    EditorView.editable.of(!props.readOnly),
    EditorView.contentAttributes.of({ 'aria-label': props.label }),
    placeholder(props.placeholder ?? ''),
    props.extensions ?? [],
  ]

  const sync = () => {
    const next = props.value
    if (!alive || view.composing || next === undefined || next === view.state.doc.toString()) {
      return
    }

    synchronizing = true
    try {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: next },
        annotations: Transaction.addToHistory.of(false),
      })
    } finally {
      synchronizing = false
    }
  }

  onSettled(() => {
    view = new EditorView({
      parent,
      state: EditorState.create({
        doc: props.value ?? props.defaultValue ?? '',
        extensions: [
          editorTheme,
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          syntaxHighlighting(highlighting),
          EditorView.lineWrapping,
          EditorView.cspNonce.of(props.cspNonce ?? ''),
          configuration.of(extension()),
          EditorView.updateListener.of((update) => {
            setState(update.state)
            if (update.docChanged && !synchronizing) {
              props.onValueChange?.(update.state.doc.toString())
              // Reconcile after CodeMirror finishes the current transaction.
              scheduleSync()
            }
          }),
        ],
      }),
    })
    setState(view.state)
    view.contentDOM.addEventListener('compositionend', scheduleSync)
    props.onViewChange?.(view)
    return () => {
      alive = false
      view.contentDOM.removeEventListener('compositionend', scheduleSync)
      view.destroy()
      props.onViewChange?.(undefined)
    }
  })

  createEffect(
    () => props.value,
    () => {
      scheduleSync()
    },
  )

  createEffect(
    () => extension(),
    (extensions) => {
      view?.dispatch({ effects: configuration.reconfigure(extensions) })
    },
  )

  return (
    <div {...rest} ref={props.ref} class={[styles.editor, props.class]}>
      <Show when={state()}>
        {(current) => (
          <MarkdownToolbar
            view={view}
            state={current()}
            label={props.toolbarLabel ?? props.label}
            commandLabel={props.commandLabel}
            config={props.toolbar}
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
