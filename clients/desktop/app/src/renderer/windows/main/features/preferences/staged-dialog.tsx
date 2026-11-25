import { createMemo, onSettled, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'
import { mdiArrowLeft } from '@mdi/js'
import { Icon } from '@kisaki3/desktop-ui/icon'
import type { Translate } from '@kisaki3/desktop-localization'
import { Button } from '@kisaki3/desktop-ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kisaki3/desktop-ui/dialog'
import { createForm, Form, FormFeedback, type FormState } from '@kisaki3/desktop-ui/form'
import type { PreferenceStage } from './draft'
import { focusPreferenceField, PreferenceFieldsContext } from './field'

export interface StagedPreferenceEdit {
  draft: PreferenceStage
  field?: string | undefined
  located?: ((found: boolean) => void) | undefined
  title: () => string
  fields: () => JSX.Element
}

interface StagedDialogProps {
  t: Translate
  edit: StagedPreferenceEdit | undefined
  bind: (form: FormState) => void
  close: () => void
  dialogRef?: ((node: HTMLDialogElement) => void) | undefined
}

export function StagedPreferenceDialog(props: StagedDialogProps) {
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
        ref={props.dialogRef}
        size="sm"
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

export function StagedPreferenceForm(
  props: Omit<StagedDialogProps, 'edit'> & { edit: StagedPreferenceEdit; inline?: boolean },
) {
  const { edit, t } = props
  const { draft } = edit
  let body!: HTMLDivElement
  let back: HTMLButtonElement | undefined

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
    queueMicrotask(() => {
      if (field && body.isConnected) {
        const found = focusPreferenceField(body, field)
        edit.located?.(found)
      } else {
        back?.focus()
      }
    })

    if (props.inline) {
      const dialog = body.closest('dialog')
      const cancel = (event: Event) => {
        if (event.target === dialog) {
          event.preventDefault()
          props.close()
        }
      }
      dialog?.addEventListener('cancel', cancel, true)
      return () => dialog?.removeEventListener('cancel', cancel, true)
    }
  })

  return (
    <>
      <DialogHeader closeLabel={t('actions.close')} class="flex items-center gap-2">
        <Show when={props.inline}>
          <Button
            ref={(node) => {
              back = node
            }}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('runtime.back')}
            onClick={props.close}
          >
            <Icon path={mdiArrowLeft} aria-hidden="true" />
          </Button>
        </Show>
        <DialogTitle>{edit.title()}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody
          ref={(element) => {
            body = element
          }}
        >
          <div class={props.inline ? 'w-full max-w-[42rem]' : undefined}>
            <PreferenceFieldsContext value={{ draft, t }}>{edit.fields()}</PreferenceFieldsContext>
          </div>
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
