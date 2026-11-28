import { createSignal, Show } from 'solid-js'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Input } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { dequal } from 'dequal'
import { ImageField, MarkdownField } from '../../../domain-ui/library/images/fields'
import { createImageDraft } from '../../../domain-ui/library/images/draft'
import {
  workTypes,
  entryTypes,
  type EntryRef,
  type DynamicRules,
  type Collection,
  type Tag,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import { EditorDialog } from '../../../../../infrastructure/dialogs/editor'
import type { EditorGuard } from '../../../../../infrastructure/dialogs/closing'
import { EntryPicker } from '../../../domain-ui/library/picker'
import { RuleGroups } from '../../../domain-ui/library/filters/rules'

export interface OrganizerEdit {
  kind: 'collection' | 'tag'
  original?: Collection | Tag
}
export function OrganizerEditor(props: {
  api: MainClient
  edit: OrganizerEdit | undefined
  close: () => void
}) {
  return (
    <EditorDialog edit={props.edit} onClose={props.close} size="md">
      {(initial, owner) => (
        <OrganizerForm
          api={props.api}
          edit={initial}
          register={owner.registerEditor}
          close={owner.requestClose}
          saved={props.close}
        />
      )}
    </EditorDialog>
  )
}
function OrganizerForm(props: {
  api: MainClient
  edit: OrganizerEdit
  register: (guard: EditorGuard) => void
  close: () => void
  saved: () => void
}) {
  const { api, edit } = props,
    t = api.t,
    original = edit.original
  const [name, setName] = createSignal(original?.name ?? ''),
    [description, setDescription] = createSignal(original?.description ?? ''),
    [nsfw, setNsfw] = createSignal(original?.isNsfw ?? false)
  const images = createImageDraft(api)
  const collection = original && 'membershipMode' in original ? original : undefined
  const originalRules =
    collection?.membershipMode === 'dynamic' && collection.dynamicRules.status === 'ready'
      ? collection.dynamicRules.value
      : undefined
  const [dynamic, setDynamic] = createSignal(collection?.membershipMode === 'dynamic'),
    [rules, setRules] = createSignal<DynamicRules>(
      originalRules ?? {
        search: '',
        sort: { type: 'field', field: 'effectiveSortName', direction: 'asc' },
        rules: [{ enabled: true, types: workTypes, filter: { match: 'all', conditions: [] } }],
        referenceLabels: [],
      },
    )
  const initialRules = rules()
  const [cover, setCover] = createSignal(collection?.primaryImageId ?? null),
    [preview, setPreview] = createSignal<string | null>(null)
  const [members, setMembers] = createSignal<readonly EntryRef[]>([]),
    [pick, setPick] = createSignal(false)
  const dirty = () =>
    name() !== (original?.name ?? '') ||
    description() !== (original?.description ?? '') ||
    nsfw() !== (original?.isNsfw ?? false) ||
    dynamic() !== (collection?.membershipMode === 'dynamic') ||
    !dequal(rules(), initialRules) ||
    cover() !== (collection?.primaryImageId ?? null) ||
    members().length > 0
  const form = createForm({
    validate: () => (name().trim() ? [] : [{ id: 'name', summary: t('forms.enterName') }]),
    onSubmit: async () => {
      const fields = {
        name: name().trim(),
        description: description().trim() ? description() : null,
        isNsfw: nsfw(),
      }
      if (original) {
        const changes: Record<string, unknown> = {},
          expected: Record<string, unknown> = {}
        for (const key of ['name', 'description', 'isNsfw'] as const) {
          if (fields[key] !== original[key]) {
            changes[key] = fields[key]
            expected[key] = original[key]
          }
        }
        if (collection && cover() !== collection.primaryImageId) {
          changes.primaryImageId = cover()
          expected.primaryImageId = collection.primaryImageId
        }
        if (collection?.membershipMode === 'dynamic' && !dequal(initialRules, rules())) {
          changes.dynamicRules = rules()
          if (originalRules) {
            expected.dynamicRules = originalRules
          }
        }
        await api.call(
          edit.kind === 'tag' ? 'library.tags.update' : 'library.collections.update',
          original.id,
          { changes, expected },
          images.ids(),
        )
      } else if (edit.kind === 'tag') {
        await api.call('library.tags.create', fields, images.ids())
      } else if (dynamic()) {
        await api.call(
          'library.collections.create',
          {
            ...fields,
            membershipMode: 'dynamic',
            primaryImageId: cover(),
            dynamicRules: rules(),
          },
          images.ids(),
        )
      } else {
        await api.call(
          'library.collections.create',
          {
            ...fields,
            primaryImageId: cover(),
            membershipMode: 'manual',
            members: members().map((entry) => ({ entry })),
          },
          images.ids(),
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
  const options = {
    emptyMessage: t('controls.search.empty'),
    invalidSelectionMessage: t('controls.feedback.unavailable'),
  }
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>
          {original
            ? original.name
            : t(
                edit.kind === 'collection'
                  ? 'library.organize.newCollection'
                  : 'library.organize.newTag',
              )}
        </DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody>
          <FieldGroup>
            <Field name="name" required>
              <FieldLabel>{t('library.fields.name')}</FieldLabel>
              <Input autofocus value={name()} onValueChange={setName} />
            </Field>
            <MarkdownField
              api={api}
              images={images}
              label={t('library.fields.description')}
              value={description()}
              change={setDescription}
            />
            <Show when={edit.kind === 'collection'}>
              <ImageField
                api={api}
                images={images}
                value={cover()}
                preview={preview()}
                label={t('library.fields.primaryImageId')}
                change={(id, url) => {
                  setCover(id)
                  setPreview(url)
                }}
              />
            </Show>

            <Field class="flex-row">
              <FieldLabel>{t('library.fields.isNsfw')}</FieldLabel>
              <Switch checked={nsfw()} onCheckedChange={setNsfw} />
            </Field>
            <Show when={edit.kind === 'collection' && (!original || dynamic())}>
              <Field>
                <FieldLabel>{t('library.organize.mode')}</FieldLabel>
                <Select
                  {...options}
                  disabled={!!original}
                  value={dynamic() ? 'dynamic' : 'manual'}
                  options={(['manual', 'dynamic'] as const).map((value) => ({
                    value,
                    label: t(`library.organize.${value}`),
                  }))}
                  onValueChange={(v) => setDynamic(v === 'dynamic')}
                />
              </Field>
              <Show
                when={dynamic()}
                fallback={
                  <Button variant="outline" onClick={() => setPick(true)}>
                    {t('library.organize.members')} · {members().length}
                  </Button>
                }
              >
                <RuleGroups
                  api={api}
                  scopeOrder={false}
                  value={rules()}
                  change={(v) => {
                    if (v.sort.type !== 'scope') {
                      setRules((before) => ({
                        ...before,
                        rules: v.rules,
                        sort: v.sort as DynamicRules['sort'],
                      }))
                    }
                  }}
                />
                <Field>
                  <FieldLabel>{t('controls.search.label')}</FieldLabel>
                  <Input
                    value={rules().search}
                    onValueChange={(search) => setRules((v) => ({ ...v, search }))}
                  />
                </Field>
              </Show>
            </Show>
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => t('forms.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={form.busy() || images.busy()}>
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </Form>
      <images.Dialog />
      <Show when={pick()}>
        <EntryPicker
          api={api}
          types={entryTypes}
          title={t('library.organize.members')}
          multiple
          initial={members()}
          choose={setMembers}
          close={() => setPick(false)}
        />
      </Show>
    </>
  )
}
