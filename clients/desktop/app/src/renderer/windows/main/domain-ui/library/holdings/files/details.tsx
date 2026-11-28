import type { HeldFile } from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { createForm, Form, FormFeedback } from '@kisaki3/desktop-ui/form'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import { createSignal, For, Show } from 'solid-js'
import type { VideoInformation } from '../../../../../../../shared/media-information'
import type { MainClient } from '../../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../../infrastructure/dialogs/closing'
import { errorMessage } from '../../../../../../infrastructure/notifications'

export function FileDetails(props: {
  api: MainClient
  file: HeldFile
  register: (v: EditorGuard) => void
  close: () => void
  saved: () => void
}) {
  const { api, file } = props,
    t = api.t
  const [note, setNote] = createSignal(file.note ?? ''),
    [media, setMedia] = createSignal<VideoInformation>(),
    [busy, setBusy] = createSignal(false),
    [error, setError] = createSignal<unknown>()
  const form = createForm({
    onSubmit: async () => {
      if (note() !== (file.note ?? '')) {
        await api.call('library.files.update', file.work, file.id, {
          changes: { note: note() || null },
          expected: { note: file.note },
        })
      }
      props.saved()
    },
  })
  props.register({
    dirty: () => note() !== (file.note ?? ''),
    save: form.submit,
    pending: () => (form.busy() ? form.submit() : undefined),
    currentFormAction: () => form.submit,
  })
  async function inspect() {
    setBusy(true)
    setError(undefined)
    try {
      setMedia(
        await api.call('library.files.inspectVideo', { type: 'anime', id: file.work.id }, file.id),
      )
    } catch (cause) {
      setError(() => cause)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{t('library.holdings.fileDetails')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody class="space-y-3">
          <p class="break-all text-sm">{file.path}</p>
          <Field>
            <FieldLabel>{t('library.fields.note')}</FieldLabel>
            <Textarea value={note()} onValueChange={setNote} />
          </Field>
          <Show
            when={file.work.type === 'anime'}
            fallback={
              <Show when={file.metadata?.status === 'ready' && file.metadata.value}>
                {(v) => <p class="text-sm">{'format' in v() ? Reflect.get(v(), 'format') : ''}</p>}
              </Show>
            }
          >
            <Button variant="outline" disabled={busy()} onClick={() => void inspect()}>
              {t('library.holdings.information')}
            </Button>
          </Show>
          <Show when={media()}>
            {(v) => (
              <section class="space-y-2 text-sm">
                <p>
                  {t('library.holdings.format')} · {v().metadata.container}
                </p>
                <p>
                  {t('library.holdings.resolution')} · {v().metadata.width} × {v().metadata.height}
                </p>
                <p>
                  {t('library.holdings.duration')} · {v().metadata.durationSeconds}
                </p>
                <h3>{t('library.holdings.tracks')}</h3>
                <For each={v().tracks}>
                  {(track) => (
                    <p>
                      {[track.type, track.codec, track.language, track.title]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </For>
                <h3>{t('library.holdings.chapters')}</h3>
                <For each={v().chapters}>
                  {(chapter) => (
                    <p>
                      {chapter.time} · {chapter.title}
                    </p>
                  )}
                </For>
              </section>
            )}
          </Show>
          <Show when={error()}>{(e) => <p role="alert">{errorMessage(e())}</p>}</Show>
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => t('forms.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={form.busy()}>
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </Form>
    </>
  )
}
