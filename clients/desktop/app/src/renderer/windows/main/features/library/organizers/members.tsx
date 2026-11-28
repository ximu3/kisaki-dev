import { createSignal, For, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { Icon } from '@kisaki3/desktop-ui/icon'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogFooter,
} from '@kisaki3/desktop-ui/dialog'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import { mdiPencilOutline, mdiPlus, mdiChevronUp, mdiChevronDown, mdiClose } from '@mdi/js'
import {
  entryTypes,
  type EntryRef,
  type CollectionMember,
  type TagEntry,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { EditorDialog } from '../../../../../infrastructure/dialogs/editor'
import type { EditorGuard } from '../../../../../infrastructure/dialogs/closing'
import { errorMessage, reportError } from '../../../../../infrastructure/notifications'
import { libraryRead } from '../../../domain-ui/library/read'
import { EntryPicker } from '../../../domain-ui/library/picker'
type Member = CollectionMember | TagEntry
interface Owner {
  kind: 'tag' | 'collection'
  id: string
  name: string
}
export function Members(props: { api: MainClient; owner: Owner; close: () => void }) {
  const { api, owner } = props,
    t = api.t,
    [offset, setOffset] = createSignal(0),
    [add, setAdd] = createSignal(false),
    [edit, setEdit] = createSignal<Member>()
  const read = libraryRead(api, ['entries', 'collections', 'tags'], async (signal) => {
    const page = await api.request(signal, 'library.organizers.members', owner.kind, owner.id, {
        offset: offset(),
        limit: 50,
      }),
      names = await api.request(
        signal,
        'library.entries.resolveRefs',
        page.items.map((m) => m.entry),
      )
    return { ...page, names: new Map(names.map((row) => [row.id, row.name])) }
  })
  async function pick(refs: readonly EntryRef[]) {
    if (refs.length) {
      await api.call('library.organizers.changeMembers', owner.kind, owner.id, {
        type: 'modify',
        add: refs.map((entry) => ({ entry })),
      })
    }
  }
  async function move(index: number, delta: number) {
    const rank = offset() + index,
      target = delta < 0 ? rank - 1 : rank + 2,
      row = read.result()?.value?.items[index]
    if (!row || target < 0) {
      return
    }
    const next = await api.call('library.organizers.members', owner.kind, owner.id, {
      offset: target,
      limit: 1,
    })
    await api.call('library.organizers.moveMember', owner.kind, owner.id, {
      ids: [row.entry],
      before: next.items[0]?.entry ?? null,
    })
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
            <DialogTitle>
              {owner.name} · {t('library.organize.members')}
            </DialogTitle>
          </DialogHeader>
          <DialogBody class="space-y-1">
            <Show when={read.result()?.error}>
              {(e) => <p role="alert">{errorMessage(e())}</p>}
            </Show>
            <Show when={read.result()?.value}>
              {(page) => (
                <>
                  <For
                    each={page().items}
                    fallback={
                      <p class="py-6 text-center text-sm text-muted-foreground">
                        {t('library.detail.empty')}
                      </p>
                    }
                  >
                    {(row, i) => (
                      <div class="flex items-center gap-1 py-1">
                        <span class="min-w-0 grow truncate text-sm">
                          {page().names.get(row.entry.id) ?? row.entry.id}
                        </span>
                        <For each={[-1, 1]}>
                          {(d) => (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={t(d < 0 ? 'actions.moveUp' : 'actions.moveDown')}
                              disabled={
                                offset() + i() + d < 0 || offset() + i() + d >= page().total
                              }
                              onClick={() => void move(i(), d).catch(reportError)}
                            >
                              <Icon path={d < 0 ? mdiChevronUp : mdiChevronDown} />
                            </Button>
                          )}
                        </For>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t('actions.edit')}
                          onClick={() => setEdit(row)}
                        >
                          <Icon path={mdiPencilOutline} />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={t('actions.remove')}
                          onClick={() =>
                            void api
                              .call('library.organizers.changeMembers', owner.kind, owner.id, {
                                type: 'modify',
                                remove: [row.entry],
                              })
                              .catch(reportError)
                          }
                        >
                          <Icon path={mdiClose} />
                        </Button>
                      </div>
                    )}
                  </For>
                  <Show when={page().total > 50}>
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
                  </Show>
                </>
              )}
            </Show>
          </DialogBody>
          <DialogFooter>
            <Button size="sm" variant="outline" class="me-auto" onClick={() => setAdd(true)}>
              <Icon path={mdiPlus} />
              {t('library.browse.pick')}
            </Button>
            <Button variant="ghost" onClick={props.close}>
              {t('actions.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Show when={add()}>
        <EntryPicker
          api={api}
          title={t('library.organize.members')}
          multiple
          types={entryTypes}
          close={() => setAdd(false)}
          choose={(refs) => void pick(refs).catch(reportError)}
        />
      </Show>
      <EditorDialog edit={edit()} size="sm" onClose={() => setEdit(undefined)}>
        {(row, g) => (
          <MemberEditor
            api={api}
            owner={owner}
            row={row}
            register={g.registerEditor}
            close={g.requestClose}
            saved={() => setEdit(undefined)}
          />
        )}
      </EditorDialog>
    </>
  )
}
function MemberEditor(props: {
  api: MainClient
  owner: Owner
  row: Member
  register: (g: EditorGuard) => void
  close: () => void
  saved: () => void
}) {
  const { api, owner, row } = props,
    t = api.t,
    [note, setNote] = createSignal(row.note ?? ''),
    initialSpoiler = 'isSpoiler' in row && row.isSpoiler,
    [spoiler, setSpoiler] = createSignal(initialSpoiler)
  const dirty = () => note() !== (row.note ?? '') || spoiler() !== initialSpoiler
  const form = createForm({
    onSubmit: async () => {
      if (dirty()) {
        const changeNote = (note() || null) !== row.note,
          changeSpoiler = spoiler() !== initialSpoiler
        await api.call(
          'library.organizers.updateMember',
          owner.kind,
          owner.id,
          row.entry,
          {
            ...(changeNote && { note: note() || null }),
            ...(changeSpoiler && { isSpoiler: spoiler() }),
          },
          {
            ...(changeNote && { note: row.note }),
            ...(changeSpoiler && { isSpoiler: initialSpoiler }),
          },
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
        <DialogTitle>{t('library.organize.members')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody class="space-y-2">
          <Field>
            <FieldLabel>{t('library.fields.note')}</FieldLabel>
            <Textarea value={note()} onValueChange={setNote} />
          </Field>
          <Show when={owner.kind === 'tag'}>
            <label class="flex items-center gap-2">
              <Checkbox checked={spoiler()} onCheckedChange={setSpoiler} />
              {t('library.relation.spoiler')}
            </label>
          </Show>
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
