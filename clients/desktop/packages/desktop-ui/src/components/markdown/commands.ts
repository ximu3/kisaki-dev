import { EditorSelection, Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { undo, redo } from '@codemirror/commands'

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

function codeFence(text: string) {
  let length = 1
  for (const run of text.matchAll(/`+/g)) {
    length = Math.max(length, run[0].length + 1)
  }
  return '`'.repeat(length)
}

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
  const markers = { bold: '**', italic: '*', strike: '~~' }
  if (command === 'bold' || command === 'italic' || command === 'strike' || command === 'code') {
    const text = view.state.sliceDoc(range.from, range.to)
    const marker = command === 'code' ? codeFence(text) : markers[command]
    const pad =
      command === 'code' && (/^`|`$/.test(text) || (/^ .* $/s.test(text) && /[^ ]/.test(text)))
        ? ' '
        : ''
    const opening = marker + pad
    const closing = pad + marker
    const wrapped =
      view.state.sliceDoc(Math.max(0, range.from - opening.length), range.from) === opening &&
      view.state.sliceDoc(range.to, range.to + closing.length) === closing
    const from = wrapped ? range.from - opening.length : range.from
    const to = wrapped ? range.to + closing.length : range.to
    const insert = wrapped ? text : `${opening}${text}${closing}`
    const start = wrapped ? from : from + opening.length

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
    const to = view.state.doc.lineAt(range.empty ? range.to : range.to - 1).to
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
