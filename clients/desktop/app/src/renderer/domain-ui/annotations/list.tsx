import type { AnnotationRef, AnnotationSummary } from '@kisaki3/desktop-contracts/library'
import type { Translate } from '@kisaki3/desktop-localization'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiBookmarkOutline, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js'
import type { JSX } from '@solidjs/web'
import { For, Show } from 'solid-js'

export function AnnotationList(props: {
  items: readonly AnnotationSummary[]
  locale: string
  t: Translate
  image: (id: string) => JSX.Element
  open: (ref: AnnotationRef) => void
  edit: (ref: AnnotationRef) => void
  remove: (row: AnnotationSummary) => void
}) {
  const { t } = props
  return (
    <div class="divide-y overflow-hidden rounded-md border">
      <For
        each={props.items}
        fallback={
          <p class="py-10 text-center text-sm text-muted-foreground">
            {t('library.detail.noRecords')}
          </p>
        }
      >
        {(row) => (
          <div class="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30">
            <button
              class="flex min-w-0 grow items-center gap-3 text-start"
              onClick={() => props.open(row.ref)}
            >
              <span class="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                <Show
                  when={row.imageId}
                  fallback={<Icon path={mdiBookmarkOutline} class="size-4" />}
                >
                  {(id) => props.image(id())}
                </Show>
              </span>
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium">{annotationTitle(row, t)}</span>
                <span class="block text-xs text-muted-foreground">
                  {t(`library.types.${row.work.type}`)} ·{' '}
                  {new Intl.DateTimeFormat(props.locale).format(row.createdAt)}
                </span>
              </span>
            </button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('actions.edit')}
              onClick={() => props.edit(row.ref)}
            >
              <Icon path={mdiPencilOutline} />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t('actions.delete')}
              onClick={() => props.remove(row)}
            >
              <Icon path={mdiTrashCanOutline} />
            </Button>
          </div>
        )}
      </For>
    </div>
  )
}

export function annotationTitle(row: AnnotationSummary, t: Translate) {
  return row.title || row.quoteExcerpt || row.contentExcerpt || t('library.records.annotations')
}
