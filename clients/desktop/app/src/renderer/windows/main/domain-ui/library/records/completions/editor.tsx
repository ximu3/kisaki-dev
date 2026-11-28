import {
  parseCompletionCreate,
  type WorkCompletion,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { createForm, Form, FormFeedback } from '@kisaki3/desktop-ui/form'
import { Input } from '@kisaki3/desktop-ui/input'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import { createSignal, For, Show } from 'solid-js'
import type { MainClient } from '../../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../../infrastructure/dialogs/closing'
import { EditorDialog } from '../../../../../../infrastructure/dialogs/editor'

export interface CompletionEdit {
  mode: 'current' | 'past' | 'edit'
  work: WorkRef
  additionalWorks?: readonly WorkRef[]
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
      } else if (edit.additionalWorks?.length) {
        const items = [
          { work: edit.work, ...value },
          ...edit.additionalWorks.map((work) => ({ work, ...value })),
        ] as const
        await api.call(
          edit.mode === 'current'
            ? 'library.completions.recordCurrentMany'
            : 'library.completions.createMany',
          items,
        )
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
          <Show when={edit.additionalWorks?.length}>
            {(count) => (
              <p class="mb-3 text-sm text-muted-foreground">
                {t('library.selection', { count: count() + 1 })}
              </p>
            )}
          </Show>
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
