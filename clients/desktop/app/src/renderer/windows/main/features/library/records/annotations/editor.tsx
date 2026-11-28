import { createSignal } from 'solid-js'
import type { Annotation } from '@kisaki3/desktop-contracts/library'
import { SavedAnnotationEditor } from '../../../../../../domain-ui/annotations/editor'
import type { MainClient } from '../../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../../infrastructure/dialogs/closing'
import { createImageDraft } from '../../../../domain-ui/library/images/draft'
import { MarkdownField, ImageField } from '../../../../domain-ui/library/images/fields'
export function AnnotationEditor(props: {
  api: MainClient
  row: Annotation
  register: (guard: EditorGuard) => void
  close: () => void
  saved: () => void
}) {
  const { api, row } = props,
    images = createImageDraft(api),
    [preview, setPreview] = createSignal<string | null>(null)
  return (
    <>
      <SavedAnnotationEditor
        t={api.t}
        row={row}
        register={props.register}
        close={props.close}
        saved={props.saved}
        preparing={images.busy}
        save={(input) =>
          api.call(
            'library.annotations.update',
            { workType: row.workType, id: row.id },
            input,
            images.ids(),
          )
        }
        Content={(field) => (
          <MarkdownField api={api} images={images} value={field.value} change={field.change} />
        )}
        Image={(field) => (
          <ImageField
            api={api}
            images={images}
            value={field.value}
            required={field.required}
            label={api.t('library.fields.primaryImageId')}
            preview={preview()}
            change={(id, url) => {
              field.change(id)
              setPreview(url)
            }}
          />
        )}
      />
      <images.Dialog />
    </>
  )
}
