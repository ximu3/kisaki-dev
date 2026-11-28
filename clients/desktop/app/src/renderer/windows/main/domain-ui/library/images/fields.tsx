import { Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { MarkdownEditor } from '@kisaki3/desktop-ui/markdown'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiImagePlusOutline } from '@mdi/js'
import type { MainClient } from '../../../../../infrastructure/api'
import type { createImageDraft } from './draft'
import { LibraryImage } from '../image'

export function ImageField(props: {
  api: MainClient
  images: ReturnType<typeof createImageDraft>
  value: string | null
  preview: string | null
  change: (id: string | null, url: string | null) => void
  label: string
  required?: boolean
}) {
  const t = props.api.t
  return (
    <Field>
      <FieldLabel>{props.label}</FieldLabel>
      <div class="flex items-center gap-2">
        <Show when={props.value}>
          {(id) => (
            <Show
              when={props.preview}
              fallback={
                <LibraryImage
                  api={props.api}
                  id={id()}
                  alt={props.label}
                  class="size-16 rounded-md object-contain"
                />
              }
            >
              {(url) => (
                <img src={url()} alt={props.label} class="size-16 rounded-md object-contain" />
              )}
            </Show>
          )}
        </Show>
        <Button
          size="sm"
          variant="outline"
          disabled={props.images.busy()}
          onClick={() =>
            void props.images.choose((image) => props.change(image.attachmentId, image.url))
          }
        >
          {t('library.detail.chooseImage')}
        </Button>
        <Show when={props.value && !props.required}>
          <Button size="sm" variant="ghost" onClick={() => props.change(null, null)}>
            {t('actions.clear')}
          </Button>
        </Show>
      </div>
    </Field>
  )
}
export function MarkdownField(props: {
  api: MainClient
  images: ReturnType<typeof createImageDraft>
  value: string
  label?: string
  change: (v: string) => void
}) {
  const t = props.api.t
  return (
    <Field>
      <FieldLabel>{props.label ?? t('library.records.content')}</FieldLabel>
      <MarkdownEditor
        label={props.label ?? t('library.records.content')}
        value={props.value}
        onValueChange={props.change}
        toolbar={[
          {
            id: 'insert-image',
            label: t('library.records.insert'),
            icon: () => <Icon path={mdiImagePlusOutline} />,
            run: (view) => {
              const original = view.state.doc,
                range = view.state.selection.main
              void props.images.choose((image) => {
                if (!original.eq(view.state.doc)) {
                  return
                }
                view.dispatch({
                  changes: {
                    from: range.from,
                    to: range.to,
                    insert: '![](attachment:' + image.attachmentId + ')',
                  },
                })
                view.focus()
              })
            },
          },
        ]}
      />
    </Field>
  )
}
