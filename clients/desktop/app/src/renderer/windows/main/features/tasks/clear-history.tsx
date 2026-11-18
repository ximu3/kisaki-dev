/** @fileoverview Confirms an irreversible cleanup of finished history by creation time. */

import { createEffect, createSignal, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kisaki3/desktop-ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { createForm, Form, FormFeedback } from '@kisaki3/desktop-ui/form'
import { DateInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import type { MainClient } from '../../../../infrastructure/api'

/** Opens a fresh cleanup edit on each invocation and closes only after clearing succeeds. */
export function ClearHistory(props: { api: MainClient; open: boolean; onClose: () => void }) {
  const { api } = props
  const [scope, setScope] = createSignal<'all' | 'before'>('all')
  const [cutoff, setCutoff] = createSignal('')
  const form = createForm({
    async onSubmit() {
      const filter =
        scope() === 'before' ? { createdBefore: new Date(cutoff() + 'T00:00:00').getTime() } : {}
      await api.call('tasks.clear', filter)
      props.onClose()
    },
  })

  createEffect(() => {
    if (props.open) {
      setScope('all')
      setCutoff('')
      form.clear()
    }
  })

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose()
        }
      }}
    >
      <DialogContent
        size="sm"
        onCloseRequest={(event) => {
          if (form.busy()) {
            event.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{api.t('runtime.clear')}</DialogTitle>
        </DialogHeader>
        <Form state={form}>
          <DialogBody>
            <FieldGroup disabled={form.busy()}>
              <Field>
                <FieldLabel>{api.t('runtime.history')}</FieldLabel>
                <Select<'all' | 'before'>
                  value={scope()}
                  defaultValue="all"
                  options={[
                    { value: 'all', label: api.t('runtime.clearAll') },
                    { value: 'before', label: api.t('runtime.clearBefore') },
                  ]}
                  emptyMessage={api.t('runtime.noOptions')}
                  invalidSelectionMessage={api.t('runtime.unavailable')}
                  onValueChange={(next) => setScope(next || 'all')}
                />
              </Field>
              <Show when={scope() === 'before'}>
                <Field name="cutoff" required>
                  <FieldLabel>{api.t('runtime.beforeDate')}</FieldLabel>
                  <DateInput
                    value={cutoff()}
                    onValueChange={setCutoff}
                    locale={document.documentElement.lang}
                    calendarLabel={api.t('runtime.calendar')}
                    monthLabel={api.t('runtime.month')}
                    yearLabel={api.t('runtime.year')}
                    previousMonthLabel={api.t('runtime.previousMonth')}
                    nextMonthLabel={api.t('runtime.nextMonth')}
                    invalidDateMessage={api.t('runtime.invalidDate')}
                  />
                </Field>
              </Show>
            </FieldGroup>
          </DialogBody>
          <DialogFooter>
            <FormFeedback summary={(count) => api.t('runtime.fieldErrors', { count })} />
            <Button autofocus variant="ghost" disabled={form.busy()} onClick={props.onClose}>
              {api.t('actions.cancel')}
            </Button>
            <Button variant="destructive" type="submit" disabled={form.busy()}>
              {api.t('runtime.clear')}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
