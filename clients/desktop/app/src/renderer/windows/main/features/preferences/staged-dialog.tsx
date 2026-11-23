import { createMemo, onSettled, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
import type { Translate } from '@kisaki3/desktop-localization'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DialogContentProps,
} from '@kisaki3/desktop-ui/dialog'
import { createForm, Form, FormFeedback, type FormState } from '@kisaki3/desktop-ui/form'
import type { PreferenceStage } from './draft'
import { focusPreferenceField, PreferenceFieldsContext } from './field'

export interface StagedPreferenceEdit {
  draft: PreferenceStage
  field?: string | undefined
  size: NonNullable<DialogContentProps['size']>
  title: () => string
  fields: () => JSX.Element
}

interface StagedDialogProps {
  t: Translate
  edit: StagedPreferenceEdit | undefined
  bind: (form: FormState) => void
  close: () => void
}

export function StagedPreferenceDialog(props: StagedDialogProps) {
  const size = createMemo<StagedPreferenceEdit['size']>((last = 'md') => props.edit?.size ?? last)

  function Content() {
    // DialogContent owns this memo's lifetime, including the outgoing transition.
    const displayed = createMemo<StagedPreferenceEdit | undefined>((last) => props.edit ?? last)
    return (
      <Show when={displayed()} keyed>
        {(edit) => <StagedPreferenceForm {...props} edit={edit} />}
      </Show>
    )
  }

  return (
    <Dialog
      open={!!props.edit}
      onOpenChange={(open) => {
        if (!open && props.edit) {
          props.close()
        }
      }}
    >
      <DialogContent
        size={size()}
        onCloseRequest={(event) => {
          event.preventDefault()
          props.close()
        }}
      >
        <Content />
      </DialogContent>
    </Dialog>
  )
}

function StagedPreferenceForm(props: StagedDialogProps & { edit: StagedPreferenceEdit }) {
  const { edit, t } = props
  const { draft } = edit
  let body!: HTMLDivElement

  const form = createForm({
    validate: draft.validate,
    locate: (id) => focusPreferenceField(body, id),
    onSubmit: () => {
      draft.apply()
      props.close()
    },
  })
  props.bind(form)

  onSettled(() => {
    const field = edit.field
    if (field) {
      // Native showModal establishes the active scope before placing field focus.
      queueMicrotask(() => form.locate(field))
    }
  })

  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{edit.title()}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody
          ref={(element) => {
            body = element
          }}
        >
          <PreferenceFieldsContext value={{ draft, t }}>{edit.fields()}</PreferenceFieldsContext>
        </DialogBody>

        <DialogFooter>
          <FormFeedback summary={(count) => t('runtime.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit">{t('actions.confirm')}</Button>
        </DialogFooter>
      </Form>
    </>
  )
}
