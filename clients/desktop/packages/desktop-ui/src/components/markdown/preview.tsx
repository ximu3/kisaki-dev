/** @fileoverview Safe Markdown presentation with instance-local labels and host-resolved images. */

import { createMemo, createUniqueId, splitProps } from 'solid-js'
import type { JSX } from 'solid-js'
import MarkdownIt from 'markdown-it'
import { footnote } from '@mdit/plugin-footnote'
import { tasklist } from '@mdit/plugin-tasklist'
import { callHandler, classes } from '../../internal/dom'
import styles from './styles.module.css'

/** Source is untrusted Markdown. Only resolveImage may supply an image URL that the host already owns. */
export interface MarkdownPreviewProps extends Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'children' | 'innerHTML'
> {
  value: string
  resolveImage?: (source: string) => string | undefined
  onNavigate?: (href: string, event: MouseEvent) => void
}

/** Raw HTML remains text; task checkboxes are read-only and footnotes use native in-page anchors. */
export function MarkdownPreview(props: MarkdownPreviewProps): JSX.Element {
  const [local, rest] = splitProps(props, [
    'value',
    'resolveImage',
    'onNavigate',
    'class',
    'onClick',
  ])

  const id = createUniqueId().replaceAll(':', '-')
  const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: true })
    .use(footnote)
    .use(tasklist, { disabled: true, label: true })
  markdown.core.ruler.after('task_list', 'preview_ids', (state) => {
    for (const token of state.tokens) {
      for (const child of token.children ?? []) {
        for (const attribute of ['id', 'for']) {
          const value = child.attrGet(attribute)
          if (value) {
            child.attrSet(attribute, `${id}-${value}`)
          }
        }
      }
    }
  })

  markdown.renderer.rules.image = (tokens, index) => {
    const token = tokens[index]!
    const alt = markdown.utils.escapeHtml(token.content)
    const source = String(token.attrGet('src') ?? '')
    const resolved = local.resolveImage?.(source)
    if (!resolved) {
      return `<span>${alt}</span>`
    }

    const title = String(token.attrGet('title') ?? '')
    return `<img src="${markdown.utils.escapeHtml(resolved)}" alt="${alt}"${title ? ` title="${markdown.utils.escapeHtml(title)}"` : ''} loading="lazy">`
  }

  const html = createMemo(() => markdown.render(local.value, { docId: id }))

  return (
    <div
      {...rest}
      class={classes(styles.preview, local.class)}
      innerHTML={html()}
      onClick={(event) => {
        callHandler(local.onClick, event)
        const link = (event.target as Element).closest('a')
        if (event.defaultPrevented || !link || !event.currentTarget.contains(link)) {
          return
        }

        const href = link.getAttribute('href') ?? ''
        if (!href.startsWith('#') && local.onNavigate) {
          event.preventDefault()
          local.onNavigate(href, event)
        }
      }}
    />
  )
}
