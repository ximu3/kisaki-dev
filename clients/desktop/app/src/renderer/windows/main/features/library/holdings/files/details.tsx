import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import { createForm, Form, FormFeedback } from '@kisaki3/desktop-ui/form'
import { dequal } from 'dequal'
import {
  partTypes,
  partWorkType,
  type PartQuery,
  type PartDetails,
  type FileWorkType,
  type HeldFile,
  type FileAssociationInput,
} from '@kisaki3/desktop-contracts/library'
import type { VideoInformation } from '../../../../../../../shared/media-information'
import type { MainClient } from '../../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../../infrastructure/dialogs/closing'
import { errorMessage } from '../../../../../../infrastructure/notifications'
import { libraryRead } from '../../../../domain-ui/library/read'

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

export function FileAssociations(props: {
  api: MainClient
  file: HeldFile
  register: (v: EditorGuard) => void
  close: () => void
  saved: () => void
}) {
  const { api, file } = props,
    t = api.t
  const [selected, setSelected] = createSignal<readonly FileAssociationInput<FileWorkType>[]>(
    file.associations,
  )
  const read = libraryRead(api, ['parts', 'holdings'], async (signal) => {
    const rows: PartDetails[] = []
    for (const partType of partTypes.filter((kind) => partWorkType(kind) === file.work.type)) {
      for (let offset = 0; ; offset += 200) {
        const page = await api.request(
          signal,
          'library.parts.list',
          { work: file.work, partType, search: '' } as PartQuery,
          { offset, limit: 200 },
        )
        rows.push(...page.items)
        if (offset + page.items.length >= page.total) {
          break
        }
      }
    }
    return rows
  })
  const dirty = () => !dequal(selected(), file.associations)
  const form = createForm({
    onSubmit: async () => {
      await api.call('library.files.associations', file.work, file.id, {
        change: { type: 'replace', items: selected() },
        ...(file.associationMode && {
          expected: { associationMode: file.associationMode, associations: file.associations },
        }),
      })
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
        <DialogTitle>{t('library.holdings.editParts')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody class="space-y-3">
          <p class="break-all text-sm">{file.path}</p>
          <For each={read.result()?.value}>
            {(row) => {
              const assoc = () =>
                selected().find(
                  (item) => item.part.type === row.ref.type && item.part.id === row.ref.id,
                )
              const name =
                row.data.name ||
                ('numberLabel' in row.data && row.data.numberLabel) ||
                t(`library.parts.${row.ref.type}`)
              return (
                <div class="flex justify-between gap-2">
                  <label class="flex items-center gap-2">
                    <Checkbox
                      checked={!!assoc()}
                      onCheckedChange={(on) =>
                        setSelected((before) =>
                          on
                            ? [...before, { part: row.ref, isPreferred: false }]
                            : before.filter((item) => item !== assoc()),
                        )
                      }
                    />
                    {name}
                  </label>
                  <Show when={assoc()}>
                    {(link) => (
                      <label class="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={!!link().isPreferred}
                          onCheckedChange={(on) =>
                            setSelected((before) =>
                              before.map((item) =>
                                item === link() ? { ...item, isPreferred: on } : item,
                              ),
                            )
                          }
                        />
                        {t('library.holdings.prefer')}
                      </label>
                    )}
                  </Show>
                </div>
              )
            }}
          </For>
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
