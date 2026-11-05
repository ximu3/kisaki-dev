/** @fileoverview CodeMirror source editing with controlled updates and instance-owned resources. */

import { createEffect, createMemo, on, onCleanup, onMount, type JSX } from 'solid-js'
import { afterEvent } from '../dom-events'
import { twMerge } from 'tailwind-merge'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import {
  Annotation,
  Compartment,
  EditorState,
  Transaction,
  type Extension,
} from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'

export interface MarkdownEditorProps {
  label: string
  value?: string
  defaultValue?: string
  onValueChange?: (text: string) => void
  readOnly?: boolean
  extensions?: Extension
  /** Receives the live view, then undefined when this subscription or editor ends. */
  onView?: (view: EditorView | undefined) => void
  class?: string
}

const external = Annotation.define<boolean>()

/** Preserve selection, native composition and undo history across owner updates. */
export function MarkdownEditor(props: MarkdownEditorProps): JSX.Element {
  let root!: HTMLDivElement
  onMount(() => {
    const configuration = new Compartment()
    const settings = createMemo((): Extension => [
      EditorView.contentAttributes.of({ 'aria-label': props.label, 'aria-multiline': 'true' }),
      EditorState.readOnly.of(props.readOnly ?? false),
      EditorView.editable.of(!props.readOnly),
      props.extensions ?? [],
    ])

    // The final DOM mutation can follow compositionend. Read the owner's settled text after it.
    const reconcile = afterEvent(() => {
      if (view.compositionStarted) {
        return
      }
      if (configuration.get(view.state) !== settings()) {
        view.dispatch({ effects: configuration.reconfigure(settings()) })
      }
      const text = props.value
      if (text !== undefined && view.state.doc.toString() !== text) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
          annotations: [external.of(true), Transaction.addToHistory.of(false)],
        })
      }
    })

    const view = new EditorView({
      parent: root,
      doc: props.value ?? props.defaultValue ?? '',
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.lineWrapping,
        configuration.of(settings()),
        EditorView.domEventObservers({
          compositionend: reconcile,
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !update.transactions.some((tr) => tr.annotation(external))) {
            reconcile()
            props.onValueChange?.(update.state.doc.toString())
          }
        }),
      ],
    })
    onCleanup(() => view.destroy())
    createEffect(on([() => props.value, settings], reconcile, { defer: true }))
    createEffect(
      on(
        () => props.onView,
        (observer) => {
          observer?.(view)
          onCleanup(() => observer?.(undefined))
        },
      ),
    )
  })

  return (
    <div
      ref={(element) => {
        root = element
      }}
      class={twMerge(
        'ks-editor ks-box min-h-24 overflow-auto rounded-md border border-border bg-input text-input-foreground focus-within:border-ring',
        props.class,
      )}
    />
  )
}
