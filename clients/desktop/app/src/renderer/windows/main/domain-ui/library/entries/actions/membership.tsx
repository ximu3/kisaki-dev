import { createSignal } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import { parseEntryUpdate, type EntryRef } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import { EditorDialog } from '../../../../../../infrastructure/dialogs/editor'
import { LibraryReferencePicker } from '../../reference-picker'

export interface MembershipEdit {
  kind: 'collection' | 'tag'
  operation: 'add' | 'remove'
  entries: readonly EntryRef[]
}
export const membershipLabels = {
  collection: {
    add: 'library.entryActions.addCollections',
    remove: 'library.entryActions.removeCollections',
  },
  tag: { add: 'library.entryActions.addTags', remove: 'library.entryActions.removeTags' },
} as const

export function MembershipEditor(props: {
  api: MainClient
  edit: MembershipEdit | undefined
  close: () => void
}) {
  const { api } = props,
    t = api.t
  return (
    <EditorDialog edit={props.edit} size="sm" onClose={props.close}>
      {(edit, controls) => {
        const [ids, setIds] = createSignal<readonly string[]>([])
        const form = createForm({
          onSubmit: async () => {
            const selected = ids()
            const change = { type: 'modify' as const }
            let changes
            if (edit.kind === 'tag') {
              changes = {
                tags:
                  edit.operation === 'add'
                    ? { ...change, add: selected.map((tagId) => ({ tagId })) }
                    : { ...change, remove: selected },
              }
            } else {
              changes = {
                collections:
                  edit.operation === 'add'
                    ? { ...change, add: selected.map((collectionId) => ({ collectionId })) }
                    : { ...change, remove: selected },
              }
            }
            const [first, ...rest] = edit.entries.map((ref) => parseEntryUpdate({ ref, changes }))
            if (first) {
              await api.call('library.entries.updateMany', [first, ...rest])
            }
            props.close()
          },
        })
        controls.registerEditor({
          dirty: () => ids().length > 0,
          save: form.submit,
          pending: () => (form.busy() ? form.submit() : undefined),
          currentFormAction: () => form.submit,
        })
        return (
          <>
            <DialogHeader closeLabel={t('actions.close')}>
              <DialogTitle>{t(membershipLabels[edit.kind][edit.operation])}</DialogTitle>
            </DialogHeader>
            <Form state={form}>
              <DialogBody class="space-y-3">
                <p class="text-sm text-muted-foreground">
                  {t('library.selection', { count: edit.entries.length })}
                </p>
                <LibraryReferencePicker
                  api={api}
                  kind={edit.kind}
                  value={ids()}
                  multiple
                  change={setIds}
                />
              </DialogBody>
              <DialogFooter>
                <FormFeedback summary={(n) => t('forms.fieldErrors', { count: n })} />
                <Button variant="ghost" onClick={controls.requestClose}>
                  {t('actions.cancel')}
                </Button>
                <Button type="submit" disabled={ids().length === 0 || form.busy()}>
                  {t('actions.save')}
                </Button>
              </DialogFooter>
            </Form>
          </>
        )
      }}
    </EditorDialog>
  )
}
