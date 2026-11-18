/** @fileoverview Presents a draft branch in its own form and applies it to preferences on confirmation. */

import { createMemo, onMount, Show, type JSX } from 'solid-js'
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

/** One opening of a draft branch and its optional field to reveal. */
export interface StagedPreferenceEdit {
  draft: PreferenceStage
  field?: string | undefined
}

/** Supplies the content and lifecycle of the currently staged preference form. */
interface StagedDialogProps<Edit extends StagedPreferenceEdit> {
  t: Translate
  edit: Edit | undefined
  title: (edit: Edit) => string
  size: (edit: Edit) => NonNullable<DialogContentProps['size']>
  bind: (form: FormState) => void
  close: () => void
  fields: (edit: Edit) => JSX.Element
}

/** Shows a staged form as a sibling of the parent form and retains its content through exit. */
export function StagedPreferenceDialog<Edit extends StagedPreferenceEdit>(
  props: StagedDialogProps<Edit>,
) {
  const size = createMemo<NonNullable<DialogContentProps['size']>>(
    (last) => (props.edit ? props.size(props.edit) : last),
    'md',
  )

  function Content() {
    // DialogContent owns this memo's lifetime, including the outgoing transition.
    const displayed = createMemo<Edit | undefined>((last) => props.edit ?? last, undefined)
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

/** Validates and applies one staged branch before returning to the parent form. */
function StagedPreferenceForm<Edit extends StagedPreferenceEdit>(
  props: StagedDialogProps<Edit> & { edit: Edit },
) {
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

  onMount(() => {
    const field = edit.field
    if (field) {
      // Native showModal establishes the active scope before placing field focus.
      queueMicrotask(() => form.locate(field))
    }
  })

  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{props.title(edit)}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody
          ref={(element) => {
            body = element
          }}
        >
          <PreferenceFieldsContext.Provider value={{ draft, t }}>
            {props.fields(edit)}
          </PreferenceFieldsContext.Provider>
        </DialogBody>

        <DialogFooter>
          <FormFeedback summary={(count) => t('runtime.fieldErrors', { count })} />
          <Button variant="outline" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit">{t('actions.confirm')}</Button>
        </DialogFooter>
      </Form>
    </>
  )
}
