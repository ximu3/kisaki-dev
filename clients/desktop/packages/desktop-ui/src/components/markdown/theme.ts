/** @fileoverview CodeMirror-owned theme rules resolve engine chrome through desktop variables. */

import { EditorView } from '@codemirror/view'

export const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--input)',
    color: 'var(--input-foreground)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', minHeight: '8rem' },
  '.cm-content': { caretColor: 'var(--foreground)' },
  '.cm-gutters': {
    backgroundColor: 'var(--muted)',
    color: 'var(--muted-foreground)',
    borderColor: 'var(--border)',
  },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--muted)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--accent)',
  },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
  '.cm-panels, .cm-tooltip': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    borderColor: 'var(--border)',
  },
  '.cm-panels.cm-panels-top': { borderBottomColor: 'var(--border)' },
  '.cm-panels.cm-panels-bottom': { borderTopColor: 'var(--border)' },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--secondary)',
    color: 'var(--secondary-foreground)',
    borderColor: 'var(--border)',
    borderRadius: 'var(--radius-sm)',
  },
  '.cm-textfield': {
    backgroundColor: 'var(--input)',
    color: 'var(--input-foreground)',
    borderColor: 'var(--border)',
  },
  '.cm-searchMatch': { backgroundColor: 'var(--muted)' },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--accent)' },
})
