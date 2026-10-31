/** @fileoverview Owns Markdown editor and preview instances while the host owns content and resources. */

import {
  Annotation,
  Compartment,
  EditorState,
  Transaction,
  type Extension,
} from '@codemirror/state'
import { EditorView, keymap, placeholder, drawSelection, type Command } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { markdown } from '@codemirror/lang-markdown'
import MarkdownIt from 'markdown-it'
import { tasklist } from '@mdit/plugin-tasklist'
import { footnote } from '@mdit/plugin-footnote'
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onMount,
  splitProps,
  type JSX,
} from 'solid-js'
import { twMerge } from 'tailwind-merge'
import { Button } from './components/button'

export {
  markdownCommands,
  markdownHeading,
  toggleMarkdownMark,
  toggleMarkdownPrefix,
  insertMarkdownLink,
  insertMarkdownImage,
  insertMarkdownTable,
  insertMarkdownFootnote,
  undo,
  redo,
} from './markdown-commands'
export { EditorView } from '@codemirror/view'
export type { Command } from '@codemirror/view'
export type { Extension } from '@codemirror/state'

const externalValue = Annotation.define<boolean>()
const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--input-foreground)',
    backgroundColor: 'var(--input)',
    fontSize: 'var(--kisaki-text-sm)',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)', lineHeight: '1.6' },
  '.cm-content': { minHeight: '5rem', padding: '0.5rem 0' },
  '.cm-line': { padding: '0 0.5rem' },
  '.cm-cursor': { borderLeftColor: 'var(--primary)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--accent)',
  },
  '.cm-placeholder': { color: 'var(--muted-foreground)' },
  '.cm-gutters': {
    backgroundColor: 'var(--muted)',
    color: 'var(--muted-foreground)',
    borderColor: 'var(--border)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--kisaki-radius-md)',
    boxShadow: 'var(--shadow-overlay)',
  },
})

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--info)', fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, color: 'var(--muted-foreground)', textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--primary)' },
  { tag: tags.quote, color: 'var(--muted-foreground)', fontStyle: 'italic' },
  { tag: [tags.monospace, tags.string], color: 'var(--success)' },
  { tag: [tags.comment, tags.meta], color: 'var(--muted-foreground)' },
  { tag: tags.keyword, color: 'var(--primary)' },
  { tag: [tags.number, tags.bool], color: 'var(--info)' },
  { tag: tags.invalid, color: 'var(--destructive)' },
])

/** Text editing and external text synchronization; a defined value is controlled by its onChange owner. */
export type MarkdownEditorProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'children' | 'onChange' | 'onInput'
> & {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  readOnly?: boolean
  disabled?: boolean
  placeholder?: string
  extensions?: Extension
  cspNonce?: string
  /** Receives the live editor and then undefined before its instance is destroyed. */
  onView?: (view: EditorView | undefined) => void
}

/** Preserve CodeMirror editing, history and IME handling, and destroy all editor resources on disposal. */
export function MarkdownEditor(props: MarkdownEditorProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'class',
    'value',
    'defaultValue',
    'onChange',
    'readOnly',
    'disabled',
    'placeholder',
    'extensions',
    'cspNonce',
    'onView',
    'aria-label',
    'aria-labelledby',
    'aria-describedby',
    'ref',
  ])
  let container!: HTMLDivElement
  const [editor, setEditor] = createSignal<EditorView>()
  const settings = new Compartment()
  let syncQueued = false

  function configuration(): Extension {
    return [
      EditorState.readOnly.of(Boolean(local.readOnly || local.disabled)),
      EditorView.editable.of(!local.disabled),
      EditorView.contentAttributes.of({
        ...(local['aria-label'] ? { 'aria-label': local['aria-label'] } : {}),
        ...(local['aria-labelledby'] ? { 'aria-labelledby': local['aria-labelledby'] } : {}),
        ...(local['aria-describedby'] ? { 'aria-describedby': local['aria-describedby'] } : {}),
        'aria-readonly': String(Boolean(local.readOnly)),
        'aria-disabled': String(Boolean(local.disabled)),
      }),
      local.placeholder ? placeholder(local.placeholder) : [],
      local.extensions ?? [],
      local.cspNonce ? EditorView.cspNonce.of(local.cspNonce) : [],
    ]
  }

  /** Coalesce host updates outside CodeMirror's update cycle and preserve unfinished composition. */
  function synchronizeValue(): void {
    if (syncQueued) {
      return
    }
    syncQueued = true
    queueMicrotask(() => {
      syncQueued = false
      const view = editor()
      const value = local.value
      if (
        !view ||
        view.compositionStarted ||
        value === undefined ||
        value === view.state.doc.toString()
      ) {
        return
      }
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
        annotations: [externalValue.of(true), Transaction.addToHistory.of(false)],
      })
    })
  }

  onMount(() => {
    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: local.value ?? local.defaultValue ?? '',
        extensions: [
          markdown(),
          history(),
          drawSelection(),
          syntaxHighlighting(markdownHighlight),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          editorTheme,
          settings.of(configuration()),
          EditorView.updateListener.of((update) => {
            if (
              update.docChanged &&
              !update.transactions.some((transaction) => transaction.annotation(externalValue))
            ) {
              local.onChange?.(update.state.doc.toString())
              synchronizeValue()
            }
          }),
          EditorView.domEventObservers({ compositionend: synchronizeValue }),
        ],
      }),
    })
    setEditor(view)
    local.onView?.(view)
  })

  createEffect(() => {
    const view = editor()
    const extension = configuration()
    if (view) {
      view.dispatch({ effects: settings.reconfigure(extension) })
    }
  })
  createEffect(() => {
    // Track the prop before scheduling a read of the latest host value.
    if (local.value !== undefined) {
      synchronizeValue()
    }
  })
  onCleanup(() => {
    const view = editor()
    setEditor(undefined)
    try {
      local.onView?.(undefined)
    } finally {
      view?.destroy()
    }
  })

  return (
    <div
      {...rest}
      ref={(element) => {
        container = element
        if (typeof local.ref === 'function') {
          local.ref(element)
        }
      }}
      class={twMerge(
        'min-h-20 min-w-0 overflow-hidden rounded-md border border-solid border-border bg-input focus-within:border-ring focus-within:outline-1 focus-within:outline-ring',
        local.disabled && 'opacity-50',
        local.class,
      )}
    />
  )
}

/** A source-editing action, with labels and icon/text content supplied by the host's locale. */
export interface MarkdownToolbarItem {
  readonly label: string
  readonly content: JSX.Element
  readonly command: Command
}

/** Tool grouping uses native tab order; extra children can provide resource insertion, preview and full-screen actions. */
export type MarkdownToolbarProps = JSX.HTMLAttributes<HTMLDivElement> & {
  view: EditorView | undefined
  items: readonly MarkdownToolbarItem[]
  disabled?: boolean
}

/** Keep pointer formatting from moving the selection, and use the same commands for keyboard activation. */
export function MarkdownToolbar(props: MarkdownToolbarProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'children', 'view', 'items', 'disabled'])
  return (
    <div
      role="group"
      {...rest}
      class={twMerge('flex flex-wrap items-center gap-0.5 font-ui', local.class)}
    >
      <For each={local.items}>
        {(item) => (
          <Button
            variant="ghost"
            size="sm"
            aria-label={item.label}
            title={item.label}
            disabled={local.disabled || !local.view}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (local.view && !local.view.compositionStarted) {
                item.command(local.view)
              }
            }}
          >
            {item.content}
          </Button>
        )}
      </For>
      {local.children}
    </div>
  )
}

/** Safe Markdown presentation. Resolved image URLs remain owned by the host and are never revoked by this component. */
export type MarkdownPreviewProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'children' | 'innerHTML' | 'onClick' | 'onAuxClick'
> & {
  value: string
  /** Map a Markdown source to an already-acquired URL; unresolved images display their alternative text. */
  resolveImage?: (source: string) => string | undefined
  /** Route non-fragment navigation through the host. Without it, ordinary browser links retain native behavior. */
  onLinkClick?: (source: string, event: MouseEvent) => void
}

/** Render the agreed syntax, escape raw HTML and keep generated footnote/task IDs local to this preview. */
export function MarkdownPreview(props: MarkdownPreviewProps): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'value', 'resolveImage', 'onLinkClick'])
  const documentId = `kisaki-markdown-${createUniqueId()}`
  const parser = new MarkdownIt({ html: false, breaks: true, linkify: true, typographer: true })
    .use(tasklist, { disabled: true })
    .use(footnote)

  for (const name of ['checkbox_input', 'label_open']) {
    parser.renderer.rules[name] = (tokens, index, options, _environment, renderer) => {
      const token = tokens[index]!
      const attribute = name === 'checkbox_input' ? 'id' : 'for'
      const value = token.attrGet(attribute)
      if (value) {
        token.attrSet(attribute, `${documentId}-${value}`)
      }
      return renderer.renderToken(tokens, index, options)
    }
  }
  parser.renderer.rules.image = (tokens, index, options, _environment, renderer) => {
    const token = tokens[index]!
    const source = String(token.attrGet('src') ?? '')
    const alternative = renderer.renderInlineAsText(token.children ?? [], options, {})
    const resolved = local.resolveImage?.(source)
    if (!resolved) {
      return `<span role="img" aria-label="${parser.utils.escapeHtml(alternative)}">${parser.utils.escapeHtml(alternative)}</span>`
    }
    token.attrSet('src', resolved)
    token.attrSet('alt', alternative)
    token.attrSet('loading', 'lazy')
    token.attrSet('decoding', 'async')
    return renderer.renderToken(tokens, index, options)
  }

  const content = createMemo(() => parser.render(local.value, { docId: documentId }))

  /** Route ordinary and auxiliary link activation without changing native fragment navigation. */
  function handleLink(event: MouseEvent): void {
    if (event.defaultPrevented || event.button > 1) {
      return
    }
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null
    const source = link?.getAttribute('href')
    if (source && !source.startsWith('#') && local.onLinkClick) {
      event.preventDefault()
      local.onLinkClick(source, event)
    }
  }

  return (
    <div
      {...rest}
      class={twMerge(
        'kisaki-markdown min-w-0 font-ui text-sm leading-relaxed text-foreground',
        local.class,
      )}
      innerHTML={content()}
      onClick={handleLink}
      onAuxClick={handleLink}
    />
  )
}
