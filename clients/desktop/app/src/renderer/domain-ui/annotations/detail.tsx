import { Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type {
  Annotation,
  AnnotationTargetByType,
  WorkType,
} from '@kisaki3/desktop-contracts/library'
import type { Translate } from '@kisaki3/desktop-localization'

export function targetOf(row: Annotation): AnnotationTargetByType[WorkType] {
  if (row.workType === 'game') {
    return { imageId: row.imageId }
  }
  if (row.workType === 'anime') {
    return { imageId: row.imageId, fileId: row.fileId, location: row.location }
  }
  return { imageId: row.imageId, fileId: row.fileId, location: row.location, quote: row.quote }
}
export function AnnotationDetail(props: {
  item: Annotation
  t: Translate
  locale: string
  image: (id: string) => JSX.Element
  markdown: (content: string) => JSX.Element
}) {
  const row = () => props.item
  function time(seconds: number) {
    return new Intl.NumberFormat(props.locale, {
      style: 'unit',
      unit: 'second',
      maximumFractionDigits: 3,
    }).format(seconds)
  }
  const position = () => {
    const item = row()
    if (item.workType === 'game') {
      return ''
    }
    if (item.workType === 'anime') {
      const p = item.location
      return p.type === 'position'
        ? time(p.positionSeconds)
        : time(p.startSeconds) + ' – ' + time(p.endSeconds)
    }
    const loc = item.location
    let page
    if (loc.type === 'region') {
      page = loc.region.page
    }
    if (loc.type === 'text' && loc.selection.type === 'pages') {
      page = loc.selection.pages[0].page
    }
    if (loc.type === 'position' && loc.position.type === 'page') {
      page = loc.position.page
    }
    if (!page) {
      return ''
    }
    return 'index' in page ? String(page.index + 1) : page.path
  }
  return (
    <section class="space-y-4">
      <Show when={row().imageId}>{(id) => props.image(id())}</Show>
      <Show when={position()}>
        {(value) => (
          <p class="text-sm text-muted-foreground">
            {props.t('library.records.position')} · {value()}
          </p>
        )}
      </Show>
      <Show
        when={(() => {
          const item = row()
          return 'quote' in item && item.quote
        })()}
      >
        {(quote) => <blockquote class="border-s-2 ps-3 text-sm">{quote()}</blockquote>}
      </Show>
      <Show when={row().content}>{(text) => props.markdown(text())}</Show>
    </section>
  )
}
