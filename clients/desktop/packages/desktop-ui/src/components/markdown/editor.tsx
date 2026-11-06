/** @fileoverview CodeMirror source editing with reactive configuration and explicit view lifetime. */

import { createEffect, onCleanup, onMount, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import { Compartment, EditorState, Transaction } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { assignRef, classes } from '../../internal/dom'
import styles from './styles.module.css'
import { editorTheme } from './theme'

const highlighting = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--primary)', fontWeight: '600' },
  { tag: tags.link, color: 'var(--primary)', textDecoration: 'underline' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, color: 'var(--foreground)', fontFamily: 'var(--font-mono)' },
  { tag: tags.meta, color: 'var(--muted-foreground)' },
])

/** The host owns text and save policy; onViewChange(undefined) invalidates the borrowed editor on unmount. */
export interface MarkdownEditorProps extends Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'onChange' | 'children'
> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void

  label: string
  placeholder?: string
  readOnly?: boolean

  extensions?: Extension
  onViewChange?: (view: EditorView | undefined) => void
  cspNonce?: string
}

/** Create one CodeMirror view. External text updates wait for composition and do not add an undo step. */
export function MarkdownEditor(props: MarkdownEditorProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'value',
    'defaultValue',
    'onValueChange',
    'label',
    'placeholder',
    'readOnly',
    'extensions',
    'onViewChange',
    'cspNonce',
    'class',
    'ref',
  ])

  let parent!: HTMLDivElement
  onMount(() => {
    const configuration = new Compartment()
    let synchronizing = false
    let alive = true
    const extension = () => [
      EditorState.readOnly.of(!!local.readOnly),
      EditorView.editable.of(!local.readOnly),
      EditorView.contentAttributes.of({ 'aria-label': local.label }),
      placeholder(local.placeholder ?? ''),
      local.extensions ?? [],
    ]

    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: local.value ?? local.defaultValue ?? '',
        extensions: [
          editorTheme,
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          syntaxHighlighting(highlighting),
          EditorView.lineWrapping,
          EditorView.cspNonce.of(local.cspNonce ?? ''),
          configuration.of(extension()),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !synchronizing) {
              local.onValueChange?.(update.state.doc.toString())
            }
          }),
        ],
      }),
    })

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
      ref={(node) => {
        parent = node
        assignRef(local.ref, node)
      }}
      class={classes(styles.editor, local.class)}
    />
  )
}
