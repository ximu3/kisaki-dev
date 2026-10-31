/** @fileoverview Implements source-editing commands with CodeMirror transactions and selection mapping. */

import { EditorSelection, type ChangeSpec } from '@codemirror/state'
import type { Command, EditorView } from '@codemirror/view'
export { undo, redo } from '@codemirror/commands'

/** Formatting must not replace a read-only document or an unfinished IME composition. */
function canEdit(view: EditorView): boolean {
  return !view.state.readOnly && !view.compositionStarted
}

/** Toggle a Markdown delimiter around every selection, retaining the selected text. */
export function toggleMarkdownMark(mark: string): Command {
  return (view) => {
    if (!canEdit(view)) {
      return false
    }
    const { state } = view
    const changes = state.changeByRange((range) => {
      const before = state.sliceDoc(Math.max(0, range.from - mark.length), range.from)
      const after = state.sliceDoc(range.to, Math.min(state.doc.length, range.to + mark.length))
      if (before === mark && after === mark) {
        return {
          changes: [
            { from: range.from - mark.length, to: range.from },
            { from: range.to, to: range.to + mark.length },
          ],
          range: EditorSelection.range(range.anchor - mark.length, range.head - mark.length),
        }
      }
      return {
        changes: {
          from: range.from,
          to: range.to,
          insert: mark + state.sliceDoc(range.from, range.to) + mark,
        },
        range: EditorSelection.range(range.anchor + mark.length, range.head + mark.length),
      }
    })
    view.dispatch({ ...changes, userEvent: 'input', scrollIntoView: true })
    view.focus()
    return true
  }
}

/** Toggle a block prefix on the selected lines, leaving cursor mapping to CodeMirror. */
export function toggleMarkdownPrefix(prefix: string): Command {
  return (view) => {
    if (!canEdit(view)) {
      return false
    }
    const lines = new Set<number>()
    for (const range of view.state.selection.ranges) {
      const first = view.state.doc.lineAt(range.from).number
      const end = view.state.doc.lineAt(range.to)
      const last = range.to > range.from && end.from === range.to ? end.number - 1 : end.number
      for (let number = first; number <= last; number++) {
        lines.add(number)
      }
    }
    const selected = [...lines]
      .sort((left, right) => left - right)
      .map((number) => view.state.doc.line(number))
    const remove = selected.every((line) => line.text.startsWith(prefix))
    const changes: ChangeSpec[] = selected.map((line) =>
      remove
        ? { from: line.from, to: line.from + prefix.length }
        : { from: line.from, insert: prefix },
    )
    view.dispatch({ changes, userEvent: 'input', scrollIntoView: true })
    view.focus()
    return true
  }
}

/** Set a heading level on selected lines; repeating the same level restores ordinary paragraphs. */
export function markdownHeading(level: 1 | 2 | 3 | 4 | 5 | 6): Command {
  const prefix = '#'.repeat(level) + ' '
  return (view) => {
    if (!canEdit(view)) {
      return false
    }
    const changes = new Map<number, { from: number; to: number; insert: string }>()
    for (const range of view.state.selection.ranges) {
      const first = view.state.doc.lineAt(range.from)
      const last = view.state.doc.lineAt(range.to > range.from ? range.to - 1 : range.to)
      for (let number = first.number; number <= last.number; number++) {
        const line = view.state.doc.line(number)
        const current = /^#{1,6} /.exec(line.text)?.[0] ?? ''
        changes.set(line.from, {
          from: line.from,
          to: line.from + current.length,
          insert: current === prefix ? '' : prefix,
        })
      }
    }
    view.dispatch({
      changes: [...changes.values()].sort((left, right) => left.from - right.from),
      userEvent: 'input',
      scrollIntoView: true,
    })
    view.focus()
    return true
  }
}

/** Preserve source text as a Markdown destination without allowing delimiters to end the link. */
function destination(source: string): string {
  return source.replace(/[\\()\s]/g, (character) =>
    /\s/.test(character) ? encodeURIComponent(character) : `\\${character}`,
  )
}

/** Insert a host-selected link. The host owns URL selection and any confirmation. */
export function insertMarkdownLink(source: string, label?: string): Command {
  return (view) => {
    if (!canEdit(view)) {
      return false
    }
    const changes = view.state.changeByRange((range) => {
      const text = (label ?? view.state.sliceDoc(range.from, range.to)).replace(/[\\[\]]/g, '\\$&')
      const insert = `[${text}](${destination(source)})`
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + insert.length),
      }
    })
    view.dispatch({ ...changes, userEvent: 'input', scrollIntoView: true })
    view.focus()
    return true
  }
}

/** Insert a host-acquired image reference; acquisition, attachment identity and ownership remain outside ui. */
export function insertMarkdownImage(source: string, alternative: string): Command {
  return (view) => {
    if (!canEdit(view)) {
      return false
    }
    const text = alternative.replace(/[\\[\]]/g, '\\$&')
    view.dispatch({
      ...view.state.replaceSelection(`![${text}](${destination(source)})`),
      userEvent: 'input',
      scrollIntoView: true,
    })
    view.focus()
    return true
  }
}

/** Insert an editable table structure without inventing user-facing cell content. */
export const insertMarkdownTable: Command = (view) => {
  if (!canEdit(view)) {
    return false
  }
  const changes = view.state.changeByRange((range) => ({
    changes: { from: range.from, to: range.to, insert: '\n|  |  |\n| --- | --- |\n|  |  |\n' },
    range: EditorSelection.cursor(range.from + 3),
  }))
  view.dispatch({
    ...changes,
    userEvent: 'input',
    scrollIntoView: true,
  })
  view.focus()
  return true
}

/** Create a distinct footnote and move the current selection into its definition. */
export const insertMarkdownFootnote: Command = (view) => {
  if (!canEdit(view)) {
    return false
  }
  const { state } = view
  const source = state.doc.toString()
  let number = 1
  while (source.includes(`[^note-${number}]`)) {
    number++
  }
  const reference = `[^note-${number}]`
  const { from, to } = state.selection.main
  const selected = state.sliceDoc(from, to)
  const definition = `\n\n${reference}: `
  view.dispatch({
    changes: [
      { from, to, insert: reference },
      { from: state.doc.length, insert: definition + selected + '\n' },
    ],
    selection: EditorSelection.cursor(
      state.doc.length + reference.length - (to - from) + definition.length,
    ),
    userEvent: 'input',
    scrollIntoView: true,
  })
  view.focus()
  return true
}

/** Common source operations; custom keymaps and toolbar items can use the same native commands. */
export const markdownCommands = {
  bold: toggleMarkdownMark('**'),
  italic: toggleMarkdownMark('*'),
  strike: toggleMarkdownMark('~~'),
  code: toggleMarkdownMark('`'),
  quote: toggleMarkdownPrefix('> '),
  bulletList: toggleMarkdownPrefix('- '),
  orderedList: toggleMarkdownPrefix('1. '),
  taskList: toggleMarkdownPrefix('- [ ] '),
  table: insertMarkdownTable,
  footnote: insertMarkdownFootnote,
} satisfies Record<string, Command>
