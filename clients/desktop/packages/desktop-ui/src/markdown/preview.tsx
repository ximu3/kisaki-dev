/** @fileoverview Renders untrusted Markdown with instance-local anchors and host-resolved images. */

import { createMemo, createUniqueId, type JSX } from 'solid-js'
import { twMerge } from 'tailwind-merge'
import MarkdownIt from 'markdown-it'
import { tasklist } from '@mdit/plugin-tasklist'
import { footnote } from '@mdit/plugin-footnote'

export interface MarkdownPreviewProps {
  value: string
  /** Return a URL already acquired by the host. Missing sources are rendered as alt text. */
  resolveImage?: (source: string) => string | undefined
  /** Handle ordinary content links. Footnote navigation stays in the document. */
  onNavigate?: (href: string, event: MouseEvent) => void
  class?: string
}

/** The parser escapes raw HTML; only plugin-generated elements enter the document. */
export function MarkdownPreview(props: MarkdownPreviewProps): JSX.Element {
  const id = createUniqueId()
  const md = new MarkdownIt({ html: false, breaks: true, linkify: true, typographer: true })
    .use(tasklist, { disabled: true })
    .use(footnote)
  md.renderer.rules.image = (tokens, index, options, env, renderer) => {
    const token = tokens[index]!
    const alt = renderer.renderInlineAsText(token.children ?? [], options, env)
    const url = props.resolveImage?.(String(token.attrGet('src') ?? ''))
    if (!url) {
      return md.utils.escapeHtml(alt)
    }
    token.attrSet('src', url)
    token.attrSet('alt', alt)
    return renderer.renderToken(tokens, index, options)
  }
  for (const [type, attribute] of [
    ['checkbox_input', 'id'],
    ['label_open', 'for'],
  ] as const) {
    md.renderer.rules[type] = (tokens, index, options, _env, renderer) => {
      const token = tokens[index]!
      token.attrSet(attribute, id + '-' + token.attrGet(attribute))
      return renderer.renderToken(tokens, index, options)
    }
  }
  const html = createMemo(() => md.render(props.value, { docId: id }))

  return (
    <div
      class={twMerge('ks-markdown text-sm text-foreground', props.class)}
      innerHTML={html()}
      onClick={(event) => {
        const link = event.target instanceof Element ? event.target.closest('a[href]') : null
        const href = link?.getAttribute('href')
        if (
          !props.onNavigate ||
          !href ||
          href.startsWith('#footnote-' + id + '-') ||
          href.startsWith('#footnote-ref-' + id + '-')
        ) {
          return
        }
        event.preventDefault()
        props.onNavigate(href, event)
      }}
    />
  )
}
