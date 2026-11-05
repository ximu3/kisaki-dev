/** @fileoverview Toolbar and host shortcuts edit the same CodeMirror document transactions. */

import { redo, undo } from '@codemirror/commands'
import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

const wraps = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  strike: ['~~', '~~'],
  code: ['`', '`'],
  link: ['[', ']()'],
  image: ['![', ']()'],
  codeBlock: ['```\n', '\n```'],
} as const
const prefixes = {
  heading: '## ',
  quote: '> ',
  bulletList: '- ',
  orderedList: '1. ',
  taskList: '- [ ] ',
} as const
export type MarkdownCommand =
  keyof typeof wraps | keyof typeof prefixes | 'table' | 'footnote' | 'undo' | 'redo'

/** Apply one undoable command at the current selection. Return whether it ran. */
export function runMarkdownCommand(view: EditorView, command: MarkdownCommand): boolean {
  if (view.state.readOnly || view.compositionStarted) {
    return false
  }
  if (command === 'undo') {
    return undo(view)
  }
  if (command === 'redo') {
    return redo(view)
  }
  const { state } = view
  const range = state.selection.main
  if (command === 'table') {
    view.dispatch(state.replaceSelection('\n|   |   |\n| --- | --- |\n|   |   |\n'))
  } else if (command === 'footnote') {
    const doc = state.doc.toString()
    let id = 1
    while (doc.includes('[^' + id + ']')) {
      id++
    }
    const ref = '[^' + id + ']'
    const changes = state.changes([
      { from: range.from, to: range.to, insert: ref },
      { from: doc.length, insert: '\n\n' + ref + ': ' },
    ])
    view.dispatch({ changes, selection: EditorSelection.cursor(changes.newLength) })
  } else if (command in wraps) {
    const [before, after] = wraps[command as keyof typeof wraps]
    const content = state.sliceDoc(range.from, range.to)
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: before + content + after },
      selection: { anchor: range.from + before.length, head: range.to + before.length },
    })
  } else {
    const prefix = prefixes[command as keyof typeof prefixes]
    const start = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(Math.max(range.from, range.to - 1)).number
    const changes = Array.from({ length: last - start + 1 }, (_, i) => ({
      from: state.doc.line(start + i).from,
      insert: prefix,
    }))
    view.dispatch({ changes })
  }
  return true
}
