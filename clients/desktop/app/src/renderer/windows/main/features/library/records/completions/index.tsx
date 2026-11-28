import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import { mdiPencilOutline, mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kisaki3/desktop-ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Input } from '@kisaki3/desktop-ui/input'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import {
  parseCompletionCreate,
  type WorkCompletion,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import { EditorDialog } from '../../../../../../infrastructure/dialogs/editor'
import { createConfirmation } from '../../../../../../infrastructure/dialogs/confirmation'
import type { EditorGuard } from '../../../../../../infrastructure/dialogs/closing'
import { errorMessage, reportError } from '../../../../../../infrastructure/notifications'
import { libraryRead } from '../../../../domain-ui/library/read'
import { calendarText } from '../../../../domain-ui/library/entry-editor/model'

export interface CompletionEdit {
  mode: 'current' | 'past' | 'edit'
  work: WorkRef
  record?: WorkCompletion
}
export function CompletionEditor(props: {
  api: MainClient
  edit: CompletionEdit | undefined
  close: () => void
}) {
  return (
    <EditorDialog edit={props.edit} size="sm" onClose={props.close}>
      {(edit, controls) => (
        <CompletionForm
          api={props.api}
          edit={edit}
          register={controls.registerEditor}
          close={controls.requestClose}
          saved={props.close}
        />
      )}
    </EditorDialog>
  )
}
function CompletionForm(props: {
  api: MainClient
  edit: CompletionEdit
  register: (guard: EditorGuard) => void
  close: () => void
  saved: () => void
}) {
  const { api, edit } = props,
    t = api.t
  const now = new Date()
  const start =
    edit.record?.completedDate ??
    (edit.mode === 'current'
      ? { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }
      : null)
  const keys = ['year', 'month', 'day'] as const
  const initial = {
    year: start?.year.toString() ?? '',
    month: start?.month.toString() ?? '',
    day: start?.day.toString() ?? '',
  }
  const [date, setDate] = createSignal(initial),
    [note, setNote] = createSignal(edit.record?.note ?? '')
  function fields() {
    const d = date()
    const completedDate = keys.every((k) => d[k] === '')
      ? null
      : { year: Number(d.year), month: Number(d.month), day: Number(d.day) }
    return parseCompletionCreate({ completedDate, note: note().trim() ? note() : null })
  }
  const dirty = () =>
    note() !== (edit.record?.note ?? '') || keys.some((key) => date()[key] !== initial[key])
  const form = createForm({
    validate: () => {
      try {
        fields()
        return []
      } catch {
        return [
          {
            id: 'date',
            summary: t('controls.calendar.invalidDate') + ' · ' + t('library.fields.note'),
          },
        ]
      }
    },
    onSubmit: async () => {
      const value = fields()
      if (edit.record) {
        const old = edit.record
        const changedDate = keys.some((key) => date()[key] !== initial[key])
        await api.call('library.completions.update', edit.work, old.id, {
          changes: {
            ...(changedDate && { completedDate: value.completedDate }),
            ...(value.note !== old.note && { note: value.note }),
          },
          expected: {
            ...(changedDate && { completedDate: old.completedDate }),
            ...(value.note !== old.note && { note: old.note }),
          },
        })
      } else {
        await api.call(
          edit.mode === 'current'
            ? 'library.completions.recordCurrent'
            : 'library.completions.create',
          edit.work,
          value,
        )
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
  const title = () =>
    t(
      (
        {
          current: 'library.detail.recordCurrent',
          past: 'library.detail.addCompletion',
          edit: 'actions.edit',
        } as const
      )[edit.mode],
    )
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{title()}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody>
          <FieldGroup>
            <Field name="date">
              <FieldLabel>{t('library.fields.completedDate')}</FieldLabel>
              <div class="grid grid-cols-3 gap-2">
                <For each={keys}>
                  {(key) => (
                    <Input
                      inputmode="numeric"
                      aria-label={t(`library.fields.${key}`)}
                      placeholder={t(`library.fields.${key}`)}
                      value={date()[key]}
                      onValueChange={(v) => setDate((row) => ({ ...row, [key]: v }))}
                    />
                  )}
                </For>
              </div>
            </Field>
            <Field>
              <FieldLabel>{t('library.fields.note')}</FieldLabel>
              <Textarea value={note()} onValueChange={setNote} />
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(n) => t('forms.fieldErrors', { count: n })} />
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

export function CompletionHistory(props: {
  api: MainClient
  work: WorkRef
  close: () => void
  edit: (edit: CompletionEdit) => void
}) {
  const { api } = props,
    t = api.t
  const [offset, setOffset] = createSignal(0)
  const list = libraryRead(api, ['entries', 'activities'], async (signal) => {
    const start = offset()
    const result = await api.request(signal, 'library.completions.list', props.work, {
      offset: start,
      limit: 50,
    })
    if (start > 0 && start >= result.total) {
      setOffset(Math.max(0, start - 50))
    }
    return result
  })
  const confirm = createConfirmation(t)
  async function remove(row: WorkCompletion) {
    if (
      await confirm.ask(
        t('library.detail.removeCompletion'),
        t('actions.delete'),
        row.note ?? calendarText(row.completedDate, api.locale()),
      )
    ) {
      await api.call('library.completions.delete', props.work, row.id)
    }
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(v) => {
          if (!v) {
            props.close()
          }
        }}
      >
        <DialogContent size="md">
          <DialogHeader closeLabel={t('actions.close')}>
            <DialogTitle>{t('library.detail.history')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Show when={list.result()?.error}>
              {(e) => <p role="alert">{errorMessage(e())}</p>}
            </Show>
            <Show when={list.result()?.value}>
              {(page) => (
                <Show
                  when={page().total}
                  fallback={
                    <p class="p-6 text-center text-sm text-muted-foreground">
                      {t('library.detail.noRecords')}
                    </p>
                  }
                >
                  <table class="w-full text-start text-sm">
                    <thead>
                      <tr>
                        <th class="text-start">{t('library.fields.completedDate')}</th>
                        <th class="text-start">{t('library.fields.note')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      <For each={page().items} keyed={(row) => row.id}>
                        {(row) => (
                          <tr class="border-t border-border">
                            <td>
                              {row().completedDate
                                ? calendarText(row().completedDate, api.locale())
                                : t('library.completion.unknownDate')}
                            </td>
                            <td class="whitespace-pre-wrap py-2">{row().note}</td>
                            <td class="text-end">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('actions.edit')}
                                onClick={() =>
                                  props.edit({ mode: 'edit', work: props.work, record: row() })
                                }
                              >
                                <Icon path={mdiPencilOutline} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('actions.delete')}
                                onClick={() => void remove(row()).catch(reportError)}
                              >
                                <Icon path={mdiTrashCanOutline} />
                              </Button>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                  <Show when={page().total > 50}>
                    <div class="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!offset()}
                        onClick={() => setOffset((n) => n - 50)}
                      >
                        {t('actions.previous')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={offset() + 50 >= page().total}
                        onClick={() => setOffset((n) => n + 50)}
                      >
                        {t('actions.next')}
                      </Button>
                    </div>
                  </Show>
                </Show>
              )}
            </Show>
          </DialogBody>
          <DialogFooter>
            <Button
              class="me-auto"
              size="sm"
              variant="outline"
              onClick={() => props.edit({ mode: 'past', work: props.work })}
            >
              <Icon path={mdiPlus} />
              {t('library.detail.addCompletion')}
            </Button>
            <Button variant="outline" onClick={props.close}>
              {t('actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <confirm.Content />
    </>
  )
}
