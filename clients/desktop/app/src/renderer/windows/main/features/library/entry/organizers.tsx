import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { parseEntryUpdate, type EntryRef } from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import { EditorDialog } from '../../../../../infrastructure/dialogs/editor'
import type { EditorGuard } from '../../../../../infrastructure/dialogs/closing'
import { FieldSection } from '../../../domain-ui/library/chrome'
import { libraryRead } from '../../../domain-ui/library/read'
import { OrganizerOperands } from '../../../domain-ui/library/filters/controls'
interface OrganizerEdit {
  kind: 'tag' | 'collection'
  ids: readonly string[]
}
export function EntryOrganizers(props: {
  api: MainClient
  entry: EntryRef
  spoilers: boolean
  open: (kind: 'tag' | 'collection', id: string, name: string) => void
}) {
  const { api } = props,
    t = api.t,
    read = libraryRead(api, ['tags', 'collections'], (signal) =>
      api.request(signal, 'library.entries.organizers', props.entry, props.spoilers),
    )
  const [edit, setEdit] = createSignal<OrganizerEdit>()
  function begin(kind: 'tag' | 'collection', rows: readonly { id: string }[]) {
    setEdit({ kind, ids: rows.map((row) => row.id) })
  }
  return (
    <>
      <Show when={read.result()?.value}>
        {(groups) => (
          <For each={['tag', 'collection'] as const}>
            {(kind) => {
              const title = () =>
                  t(kind === 'tag' ? 'library.pages.tags' : 'library.pages.collections'),
                items = () => (kind === 'tag' ? groups().tags : groups().collections)
              return (
                <FieldSection
                  title={title()}
                  editLabel={t('actions.editItem', { name: title() })}
                  edit={() => begin(kind, items())}
                >
                  <div class="flex flex-wrap gap-1.5">
                    <For
                      each={items()}
                      fallback={
                        <p class="text-xs italic text-muted-foreground">
                          {t('library.detail.empty')}
                        </p>
                      }
                    >
                      {(row) => (
                        <Button
                          size="sm"
                          variant="secondary"
                          class="h-6 px-2 text-xs"
                          title={row.note ?? row.name}
                          onClick={() => props.open(kind, row.id, row.name)}
                        >
                          {row.name}
                        </Button>
                      )}
                    </For>
                  </div>
                </FieldSection>
              )
            }}
          </For>
        )}
      </Show>
      <EditorDialog edit={edit()} size="md" onClose={() => setEdit(undefined)}>
        {(action, guard) => (
          <MembershipForm
            api={api}
            entry={props.entry}
            action={action}
            register={guard.registerEditor}
            close={guard.requestClose}
            saved={() => setEdit(undefined)}
          />
        )}
      </EditorDialog>
    </>
  )
}
function MembershipForm(props: {
  api: MainClient
  entry: EntryRef
  action: OrganizerEdit
  register: (guard: EditorGuard) => void
  close: () => void
  saved: () => void
}) {
  const { api, action } = props,
    t = api.t,
    [picked, setPicked] = createSignal(action.ids)
  const dirty = () =>
    picked().length !== action.ids.length || picked().some((id) => !action.ids.includes(id))
  const form = createForm({
    onSubmit: async () => {
      const add = picked().filter((id) => !action.ids.includes(id)),
        remove = action.ids.filter((id) => !picked().includes(id))
      if (add.length || remove.length) {
        const changes =
          action.kind === 'tag'
            ? {
                tags: {
                  type: 'modify' as const,
                  ...(add.length && { add: add.map((tagId) => ({ tagId })) }),
                  ...(remove.length && { remove }),
                },
              }
            : {
                collections: {
                  type: 'modify' as const,
                  ...(add.length && { add: add.map((collectionId) => ({ collectionId })) }),
                  ...(remove.length && { remove }),
                },
              }
        await api.call(
          'library.entries.update',
          parseEntryUpdate({ ref: props.entry, changes }),
          [],
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
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>
          {t(action.kind === 'tag' ? 'library.pages.tags' : 'library.pages.collections')}
        </DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody>
          <OrganizerOperands
            api={api}
            kind={action.kind}
            multiple
            value={picked()}
            change={setPicked}
          />
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
