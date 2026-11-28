import { entryTypes, type EntryRef, type Note } from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { createForm, Form, FormFeedback } from '@kisaki3/desktop-ui/form'
import { Input } from '@kisaki3/desktop-ui/input'
import { dequal } from 'dequal'
import { createSignal, For, Show } from 'solid-js'
import type { MainClient } from '../../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../../infrastructure/dialogs/closing'
import { EntryPicker } from '../../entries/picker'
import { createImageDraft } from '../../images/draft'
import { ImageField, MarkdownField } from '../../images/fields'
import { libraryRead } from '../../read'

export interface NoteEdit {
  note?: Note
  entries: readonly EntryRef[]
}

export function NoteEditor(props: {
  api: MainClient
  edit: NoteEdit
  close: () => void
  saved: () => void
  register: (guard: EditorGuard) => void
}) {
  const { api, edit } = props,
    t = api.t,
    images = createImageDraft(api),
    saved = edit.note
  const initial = {
    title: saved?.title ?? null,
    content: saved?.content ?? '',
    primaryImageId: saved?.primaryImageId ?? null,
    entries: edit.entries,
  }
  const [title, setTitle] = createSignal(initial.title ?? ''),
    [content, setContent] = createSignal(initial.content),
    [cover, setCover] = createSignal(initial.primaryImageId),
    [preview, setPreview] = createSignal<string | null>(null)
  const [entries, setEntries] = createSignal(initial.entries),
    [picking, setPicking] = createSignal(false)
  const names = libraryRead(api, ['entries'], async (signal) => {
    const rows = entries(),
      result = new Map<string, string>()
    for (let i = 0; i < rows.length; i += 200) {
      for (const item of await api.request(
        signal,
        'library.entries.resolveRefs',
        rows.slice(i, i + 200),
      )) {
        result.set(item.id, item.name)
      }
    }
    return result
  })
  const fields = () => ({
    title: title().trim() || null,
    content: content(),
    primaryImageId: cover(),
    entries: entries(),
  })
  const dirty = () => !dequal(fields(), initial)
  const form = createForm({
    onSubmit: async () => {
      if (images.busy()) {
        return
      }
      if (saved) {
        const values = fields(),
          changes = Object.fromEntries(
            Object.entries(values).filter(([k, v]) => !dequal(v, Reflect.get(initial, k))),
          ),
          expected = Object.fromEntries(
            Object.keys(changes).map((k) => [k, Reflect.get(initial, k)]),
          )
        await api.call('library.notes.update', saved.id, { changes, expected }, images.ids())
      } else {
        await api.call('library.notes.create', fields(), images.ids())
      }
      props.saved()
    },
  })
  props.register({
    dirty,
    save: form.submit,
    pending: () => (form.busy() ? form.submit() : undefined),
    currentFormAction: () => form.submit,
  })
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>
          {t(saved ? 'library.records.editNote' : 'library.records.newNote')}
        </DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('library.records.title')}</FieldLabel>
              <Input autofocus value={title()} onValueChange={setTitle} />
            </Field>
            <MarkdownField api={api} images={images} value={content()} change={setContent} />
            <ImageField
              api={api}
              images={images}
              label={t('library.records.cover')}
              value={cover()}
              preview={preview()}
              change={(id, url) => {
                setCover(id)
                setPreview(url)
              }}
            />
            <Field>
              <FieldLabel>{t('library.records.entries')}</FieldLabel>
              <div class="flex flex-wrap gap-1">
                <For each={entries()}>
                  {(ref) => (
                    <span class="rounded bg-secondary px-2 py-1 text-xs">
                      {names.result()?.value?.get(ref.id) ?? ref.id}
                    </span>
                  )}
                </For>
                <Button size="sm" variant="outline" onClick={() => setPicking(true)}>
                  {t('library.browse.pick')}
                </Button>
              </div>
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => t('forms.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={form.busy() || images.busy()}>
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </Form>
      <Show when={picking()}>
        <EntryPicker
          api={api}
          types={entryTypes}
          title={t('library.records.entries')}
          multiple
          initial={entries()}
          choose={setEntries}
          close={() => setPicking(false)}
        />
      </Show>
      <images.Dialog />
    </>
  )
}
