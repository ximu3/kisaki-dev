/** @fileoverview Markdown formatting commands edit the same CodeMirror transaction and undo history. */

import { EditorSelection, Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'

/** Source-formatting actions; link and image resource selection remains a host operation. */
export type MarkdownCommand =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'heading'
  | 'bullet'
  | 'ordered'
  | 'quote'
  | 'task'
  | 'link'
  | 'undo'
  | 'redo'

/** Apply to the current primary selection in a live view; read-only views return false. */
export function runMarkdownCommand(view: EditorView, command: MarkdownCommand): boolean {
  if (view.state.readOnly) {
    return false
  }

  if (command === 'undo') {
    return undo(view)
  }
  if (command === 'redo') {
    return redo(view)
  }

  const range = view.state.selection.main
  const markers = { bold: '**', italic: '*', strike: '~~', code: '`' }
  if (command === 'bold' || command === 'italic' || command === 'strike' || command === 'code') {
    const marker = markers[command]
    const text = view.state.sliceDoc(range.from, range.to)
    const wrapped =
      view.state.sliceDoc(Math.max(0, range.from - marker.length), range.from) === marker &&
      view.state.sliceDoc(range.to, range.to + marker.length) === marker
    const from = wrapped ? range.from - marker.length : range.from
    const to = wrapped ? range.to + marker.length : range.to
    const insert = wrapped ? text : `${marker}${text}${marker}`
    const start = wrapped ? from : from + marker.length

    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.range(start, start + text.length),
      annotations: Transaction.userEvent.of('input'),
    })
  } else if (command === 'link') {
    const text = view.state.sliceDoc(range.from, range.to)
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: `[${text}](https://)` },
      selection: EditorSelection.range(range.from + text.length + 3, range.from + text.length + 11),
      annotations: Transaction.userEvent.of('input'),
    })
  } else {
    const prefix = { heading: '## ', bullet: '- ', ordered: '1. ', quote: '> ', task: '- [ ] ' }[
      command
    ]
    const from = view.state.doc.lineAt(range.from).from
    const to = view.state.doc.lineAt(range.to).to
    const lines = view.state.sliceDoc(from, to).split('\n')
    const remove = lines.every((line) => line.startsWith(prefix))

    view.dispatch({
      changes: {
        from,
        to,
        insert: lines
          .map((line) => (remove ? line.slice(prefix.length) : prefix + line))
          .join('\n'),
      },
      annotations: Transaction.userEvent.of('input'),
    })
  }

  view.focus()
  return true
}
