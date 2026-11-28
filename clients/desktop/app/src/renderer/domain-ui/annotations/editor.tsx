import { createSignal } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import { Input } from '@kisaki3/desktop-ui/input'
import type { Annotation, AnnotationUpdate } from '@kisaki3/desktop-contracts/library'
import type { Component } from 'solid-js'
import type { Translate } from '@kisaki3/desktop-localization'
import type { EditorGuard } from '../../infrastructure/dialogs/closing'
import { targetOf } from './detail'
export function SavedAnnotationEditor(props: {
  t: Translate
  row: Annotation
  register: (guard: EditorGuard) => void
  close: () => void
  saved: () => void
  preparing: () => boolean
  save: (input: AnnotationUpdate) => Promise<void>
  Content: Component<{ value: string; change: (content: string) => void }>
  Image: Component<{
    value: string | null
    required: boolean
    change: (image: string | null) => void
  }>
}) {
  const { row, t } = props
  const [title, setTitle] = createSignal(row.title ?? ''),
    [content, setContent] = createSignal(row.content),
    [image, setImage] = createSignal(row.imageId as string | null)
  const dirty = () =>
    title() !== (row.title ?? '') || content() !== row.content || image() !== row.imageId
  const form = createForm({
    onSubmit: async () => {
      const oldTarget = targetOf(row),
        newTitle = title().trim() || null
      const target = image() === row.imageId ? undefined : { ...oldTarget, imageId: image() }
      const input = {
        changes: {
          ...(target && { target }),
          ...(newTitle !== row.title && { title: newTitle }),
          ...(row.content !== content() && { content: content() }),
        },
        expected: {
          ...(target && { target: oldTarget }),
          ...(newTitle !== row.title && { title: row.title }),
          ...(row.content !== content() && { content: row.content }),
        },
      } as AnnotationUpdate
      await props.save(input)
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
        <DialogTitle>{t('library.pages.annotations')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody>
          <FieldGroup>
            <Field>
              <FieldLabel>{t('library.records.title')}</FieldLabel>
              <Input autofocus value={title()} onValueChange={setTitle} />
            </Field>
            <props.Content value={content()} change={setContent} />
            <props.Image value={image()} change={setImage} required={row.workType === 'game'} />
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => t('forms.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={form.busy() || props.preparing()}>
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </Form>
    </>
  )
}
