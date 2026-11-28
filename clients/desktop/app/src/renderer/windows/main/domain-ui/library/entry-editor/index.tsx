import { createSignal, For, Show, Switch, Match } from 'solid-js'
import { dequal } from 'dequal'
import {
  entryTypes,
  parseEntryCreate,
  parseEntryUpdate,
  type EntryRef,
  type EntryType,
} from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Input, NumberInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import type { MainClient } from '../../../../../infrastructure/api'
import { createImageDraft } from '../images/draft'
import type { EditorGuard } from '../../../../../infrastructure/dialogs/closing'
import { ImageField, MarkdownField } from '../images/fields'
import { EditorDialog } from '../../../../../infrastructure/dialogs/editor'
import { LinkFields, IdentityFields } from './references'
import { InformationFields } from './information'
import { information, type EntryEdit } from './model'

export function EntryEditorDialog(props: {
  api: MainClient
  edit: EntryEdit | undefined
  close: () => void
  saved: (ref: EntryRef) => void
}) {
  return (
    <EditorDialog edit={props.edit} size="md" onClose={props.close}>
      {(edit, owner) => (
        <EntryForm
          api={props.api}
          edit={edit}
          register={owner.registerEditor}
          close={owner.requestClose}
          saved={props.saved}
        />
      )}
    </EditorDialog>
  )
}

function EntryForm(props: {
  api: MainClient
  edit: EntryEdit
  register: (guard: EditorGuard) => void
  close: () => void
  saved: (ref: EntryRef) => void
}) {
  const { api, edit } = props
  const t = api.t
  const field = edit.field
  const entry = edit.field === 'create' ? undefined : edit.entry
  const work = entry && 'record' in entry ? entry : undefined
  const original: Record<string, unknown> =
    field === 'information' && entry ? information(entry) : {}
  const originalText = () => {
    switch (field) {
      case 'name':
        return entry!.name
      case 'originalName':
        return entry!.originalName ?? ''
      case 'description':
        return edit.field === 'description' ? (edit.description ?? '') : ''
      case 'rating':
        return entry!.evaluation.rating === null ? '' : String(entry!.evaluation.rating / 10)
      case 'additionalTime':
        return String((work?.record.additionalDurationMs ?? 0) / 60000)
      case 'additionalCount':
        return String(work?.record.additionalCompletionCount ?? 0)
      case 'create':
      case 'images':
      case 'information':
      case 'links':
      case 'identities':
        return ''
    }
  }
  const [text, setText] = createSignal(originalText())
  const [info, setInfo] = createSignal(original)
  const [kind, setKind] = createSignal<EntryType>(
    entry?.type ?? (edit.field === 'create' ? edit.type : 'game'),
  )
  const [links, setLinks] = createSignal([...(entry?.externalLinks ?? [])])
  const [identities, setIdentities] = createSignal([...(entry?.externalIdentities ?? [])])
  const draftImages = createImageDraft(api)
  const media = () => {
    const type = kind()
    return type === 'game' || type === 'anime' || type === 'comic' || type === 'novel'
  }
  const imageFields = () =>
    [
      'primaryImageId',
      ...(media() ? (['backdropImageId', 'titleLogoId'] as const) : []),
      ...(kind() === 'game' ? ['iconImageId' as const] : []),
    ] as const
  const originalImage = (key: string) =>
    entry ? ((Reflect.get(entry, key) as string | null) ?? null) : null
  const [pictures, setPictures] = createSignal<
    Record<string, { id: string | null; url: string | null }>
  >({})
  const imageValue = (key: string) =>
    pictures()[key]?.id === undefined ? originalImage(key) : pictures()[key]!.id
  const dirty = () =>
    text() !== originalText() ||
    !dequal(info(), original) ||
    imageFields().some((key) => imageValue(key) !== originalImage(key)) ||
    !dequal(links(), entry?.externalLinks ?? []) ||
    !dequal(identities(), entry?.externalIdentities ?? []) ||
    (edit.field === 'create' && kind() !== edit.type)
  const title = () =>
    field === 'create'
      ? t('library.detail.createEntry')
      : t(
          (
            {
              name: 'library.fields.name',
              originalName: 'library.fields.originalName',
              description: 'library.fields.description',
              information: 'library.fields.information',
              rating: 'library.fields.rating',
              additionalTime: 'library.fields.additionalTime',
              additionalCount: 'library.fields.additionalCount',
              images: 'library.fields.primaryImageId',
              links: 'library.fields.links',
              identities: 'library.fields.id',
            } as const
          )[field],
        )
  async function save() {
    const holds = draftImages.ids()
    if (!entry) {
      const ref = await api.call(
        'library.entries.create',
        parseEntryCreate({
          type: kind(),
          name: text().trim(),
          ...Object.fromEntries(imageFields().map((key) => [key, imageValue(key)])),
        }),
        holds,
      )
      props.saved(ref)
      return
    }
    const ref = { type: entry.type, id: entry.id }
    const changes: Record<string, unknown> = {},
      expected: Record<string, unknown> = {}
    function diff(key: string, prior: unknown, next: unknown) {
      if (!dequal(prior, next)) {
        changes[key] = next
        expected[key] = prior
      }
    }
    switch (field) {
      case 'information': {
        for (const [key, raw] of Object.entries(info())) {
          const next = Array.isArray(raw) ? raw.filter((v) => v !== '') : raw
          diff(key, original[key], next)
        }
        break
      }
      case 'name':
        diff('name', entry.name, text().trim())
        break
      case 'originalName':
        diff('originalName', entry.originalName, text().trim() || null)
        break
      case 'description':
        diff(
          'description',
          edit.field === 'description' ? edit.description : null,
          text().trim() ? text() : null,
        )
        break
      case 'rating':
        diff(
          'evaluation',
          { rating: entry.evaluation.rating },
          { rating: text().trim() === '' ? null : Math.round(Number(text()) * 10) },
        )
        break
      case 'additionalTime':
        diff(
          'record',
          { additionalDurationMs: work!.record.additionalDurationMs },
          { additionalDurationMs: Math.round(Number(text()) * 60000) },
        )
        break
      case 'additionalCount':
        diff(
          'record',
          { additionalCompletionCount: work!.record.additionalCompletionCount },
          { additionalCompletionCount: Number(text()) },
        )
        break
      case 'images':
        for (const key of imageFields()) {
          diff(key, originalImage(key), imageValue(key))
        }
        break
      case 'links':
        diff('externalLinks', entry.externalLinks, links())
        break
      case 'identities':
        diff('externalIdentities', entry.externalIdentities, identities())
        break
      case 'create':
        break
    }
    if (Object.keys(changes).length) {
      await api.call('library.entries.update', parseEntryUpdate({ ref, changes, expected }), holds)
    }
    props.saved(ref)
  }

  const form = createForm({
    validate: () =>
      (field === 'name' || field === 'create') && !text().trim()
        ? [{ id: 'name', summary: t('forms.enterName') }]
        : [],
    onSubmit: save,
  })
  props.register({
    dirty,
    save: form.submit,
    pending: () => (form.busy() ? form.submit() : undefined),
    currentFormAction: () => form.submit,
  })
  const select = {
    emptyMessage: t('controls.search.empty'),
    invalidSelectionMessage: t('controls.feedback.unavailable'),
  }
  const numbers = {
    increaseLabel: t('controls.number.increase'),
    decreaseLabel: t('controls.number.decrease'),
  }

  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{title()}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody>
          <fieldset disabled={form.busy()}>
            <FieldGroup>
              <Show when={field === 'create'}>
                <Field>
                  <FieldLabel>{t('library.detail.media')}</FieldLabel>
                  <Select
                    {...select}
                    value={kind()}
                    options={entryTypes.map((value) => ({
                      value,
                      label: t(`library.types.${value}`),
                    }))}
                    onValueChange={(v) => {
                      if (v) {
                        setKind(v)
                      }
                    }}
                  />
                </Field>
              </Show>
              <Switch>
                <Match when={field === 'create' || field === 'name' || field === 'originalName'}>
                  <Field name="name" required={field !== 'originalName'}>
                    <FieldLabel>
                      {t(
                        field === 'originalName'
                          ? 'library.fields.originalName'
                          : 'library.fields.name',
                      )}
                    </FieldLabel>
                    <Input autofocus value={text()} onValueChange={setText} />
                  </Field>
                </Match>
                <Match when={field === 'description'}>
                  <MarkdownField
                    api={api}
                    images={draftImages}
                    label={title()}
                    value={text()}
                    change={setText}
                  />
                </Match>
                <Match when={field === 'information'}>
                  <InformationFields
                    t={t}
                    value={info()}
                    type={kind()}
                    change={(key, v) => setInfo((before) => ({ ...before, [key]: v }))}
                  />
                </Match>
                <Match
                  when={
                    field === 'rating' || field === 'additionalTime' || field === 'additionalCount'
                  }
                >
                  <Show when={field === 'additionalTime'}>
                    <div class="text-sm text-muted-foreground">
                      {t('library.fields.recordedTime')} ·{' '}
                      {t('library.fields.minutes', {
                        count: Math.round(
                          (work!.totalDurationMs - work!.record.additionalDurationMs) / 60000,
                        ),
                      })}
                    </div>
                  </Show>
                  <Field>
                    <FieldLabel>{title()}</FieldLabel>
                    <NumberInput
                      {...numbers}
                      min={0}
                      {...(field === 'rating' && { max: 10 })}
                      step={
                        ({ rating: 0.1, additionalCount: 1, additionalTime: 'any' } as const)[
                          field as 'rating' | 'additionalCount' | 'additionalTime'
                        ]
                      }
                      value={text()}
                      onValueChange={setText}
                    />
                  </Field>
                </Match>
                <Match when={field === 'links'}>
                  <LinkFields t={t} value={links()} change={setLinks} />
                </Match>
                <Match when={field === 'identities'}>
                  <IdentityFields t={t} value={identities()} change={setIdentities} />
                </Match>
              </Switch>
              <Show when={field === 'images' || field === 'create'}>
                <For each={imageFields()}>
                  {(key) => (
                    <ImageField
                      api={api}
                      images={draftImages}
                      label={t(`library.fields.${key}`)}
                      value={imageValue(key)}
                      preview={pictures()[key]?.url ?? null}
                      change={(id, url) => setPictures((v) => ({ ...v, [key]: { id, url } }))}
                    />
                  )}
                </For>
              </Show>
            </FieldGroup>
          </fieldset>
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => t('forms.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.close}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" disabled={form.busy() || draftImages.busy()}>
            {t('actions.save')}
          </Button>
        </DialogFooter>
      </Form>
      <draftImages.Dialog />
    </>
  )
}
