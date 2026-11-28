import type { PartialDate } from '@kisaki3/desktop-contracts/date'
import {
  parsePartCreate,
  parsePartKindChange,
  parsePartUpdate,
  type ExternalIdentity,
  type ExternalLink,
  type FileWorkType,
  type PartDetails,
  type PartType,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { createForm, Form, FormFeedback } from '@kisaki3/desktop-ui/form'
import { Input, NumberInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import { dequal } from 'dequal'
import { createSignal, For, Show } from 'solid-js'
import type { MainClient } from '../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../infrastructure/dialogs/closing'
import { DateParts } from '../fields/date-parts'
import { IdentityFields, LinkFields } from '../fields/references'
import { createImageDraft } from '../images/draft'
import { ImageField, MarkdownField } from '../images/fields'

export interface PartEdit {
  work: WorkRef<FileWorkType>
  kind: PartType
  saved?: PartDetails
}

export function PartEditor(props: {
  api: MainClient
  edit: PartEdit
  register: (g: EditorGuard) => void
  close: () => void
  saved: () => void
}) {
  const { api, edit } = props,
    t = api.t,
    images = createImageDraft(api)
  const { saved } = edit
  const originalKind = saved?.ref.type ?? edit.kind
  const [kind, setKind] = createSignal<PartType>(edit.kind)
  const before: Record<string, unknown> = saved ? { ...saved.data } : {}
  const [fields, setFields] = createSignal(before),
    [preview, setPreview] = createSignal<string | null>(null)
  const [classifications, setClassifications] = createSignal<
    Partial<Record<PartType, string | null>>
  >({ [originalKind]: (before.type as string | null) ?? null })
  const subtype = () => classifications()[kind()] ?? null
  const [number, setNumber] = createSignal((before.numberLabel as string | null) ?? '')
  function field(key: string, value: unknown) {
    setFields((row) => ({ ...row, [key]: value }))
  }
  const subtypes = () =>
    kind() === 'animeEpisode'
      ? (['regular', 'special'] as const)
      : (['opening', 'ending', 'promotion', 'interview', 'other'] as const)
  const initialNumber = number()
  const measures = () =>
    (
      {
        animeEpisode: ['declaredDurationMs'],
        animeExtra: ['declaredDurationMs'],
        comicVolume: ['declaredPageCount', 'declaredChapterCount'],
        comicChapter: ['declaredPageCount'],
        novelVolume: ['declaredPageCount'],
      } as const
    )[kind()]
  const dirty = () =>
    kind() !== originalKind ||
    !dequal(fields(), before) ||
    subtype() !== (before.type ?? null) ||
    number() !== initialNumber
  const form = createForm({
    onSubmit: async () => {
      const values = {
        ...fields(),
        ...(kind() !== 'animeExtra' && { numberLabel: number() || null }),
        ...((kind() === 'animeEpisode' || kind() === 'animeExtra') && { type: subtype() }),
      }
      if (
        kind() !== originalKind &&
        saved &&
        (saved.ref.type === 'animeExtra' || saved.ref.type === 'animeEpisode')
      ) {
        const ref = { id: saved.ref.id, type: saved.ref.type }
        const changes = Object.fromEntries(
            Object.entries(fields()).filter(([key, v]) => !dequal(v, before[key])),
          ),
          expected = Object.fromEntries(Object.keys(changes).map((k) => [k, before[k]]))
        const input = parsePartKindChange(ref, {
          target: {
            kind: kind(),
            type: subtype(),
            ...(kind() === 'animeEpisode' && { numberLabel: number() || null }),
          },
          changes,
          expected: {
            ...expected,
            type: before.type,
            ...(saved.ref.type === 'animeEpisode' && { numberLabel: before.numberLabel }),
          },
        })
        await api.call('library.parts.changeKind', ref, input, images.ids())
      } else if (saved) {
        const changes = Object.fromEntries(
            Object.entries(values).filter(([key, v]) => !dequal(v, before[key])),
          ),
          expected = Object.fromEntries(Object.keys(changes).map((k) => [k, before[k]]))
        await api.call(
          'library.parts.update',
          parsePartUpdate({ ref: saved.ref, changes, expected }),
          images.ids(),
        )
      } else {
        await api.call(
          'library.parts.create',
          parsePartCreate({ type: kind(), work: edit.work, data: values }),
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
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{t(`library.parts.${kind()}`)}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody>
          <FieldGroup>
            <Show when={edit.work.type === 'anime'}>
              <Field>
                <FieldLabel>{t('library.ruleEditor.kind')}</FieldLabel>
                <Select
                  value={kind()}
                  options={(['animeEpisode', 'animeExtra'] as const).map((value) => ({
                    value,
                    label: t(`library.parts.${value}`),
                  }))}
                  emptyMessage={t('controls.search.empty')}
                  invalidSelectionMessage={t('controls.feedback.unavailable')}
                  onValueChange={(v) => {
                    if (v === 'animeEpisode' || v === 'animeExtra') {
                      setKind(v)
                    }
                  }}
                />
              </Field>
            </Show>
            <For each={['name', 'originalName'] as const}>
              {(key) => (
                <Field>
                  <FieldLabel>{t(`library.fields.${key}`)}</FieldLabel>
                  <Input
                    value={String((fields()[key] as number | string | null) ?? '')}
                    onValueChange={(v) => field(key, v || null)}
                  />
                </Field>
              )}
            </For>
            <Show when={kind() !== 'animeExtra'}>
              <Field>
                <FieldLabel>{t('library.holdings.number')}</FieldLabel>
                <Input value={number()} onValueChange={setNumber} />
              </Field>
            </Show>
            <Show when={kind() === 'animeEpisode' || kind() === 'animeExtra'}>
              <Field>
                <FieldLabel>{t('library.ruleEditor.subtype')}</FieldLabel>
                <Select
                  emptyMessage={t('controls.search.empty')}
                  invalidSelectionMessage={t('controls.feedback.unavailable')}
                  options={[
                    { value: '', label: t('library.status.unset') },
                    ...subtypes().map((value) => ({
                      value,
                      label: t(`library.ruleEditor.${value}`),
                    })),
                  ]}
                  value={subtype() ?? ''}
                  onValueChange={(v) =>
                    setClassifications((before) => ({ ...before, [kind()]: v || null }))
                  }
                />
              </Field>
            </Show>
            <Field>
              <FieldLabel>{t('library.fields.aliases')}</FieldLabel>
              <Textarea
                rows={1}
                value={((fields().aliases as readonly string[]) ?? []).join('\n')}
                onValueChange={(v) => field('aliases', v.split('\n'))}
              />
            </Field>
            <For each={measures()}>
              {(key) => (
                <Field>
                  <FieldLabel>{t(`library.fields.${key}`)}</FieldLabel>
                  <NumberInput
                    value={String((fields()[key] as number | string | null) ?? '')}
                    min={0}
                    step={1}
                    increaseLabel={t('controls.number.increase')}
                    decreaseLabel={t('controls.number.decrease')}
                    onValueChange={(v) => field(key, v === '' ? null : Number(v))}
                  />
                </Field>
              )}
            </For>
            <DateParts
              t={t}
              label={t('library.fields.releaseDate')}
              value={fields().releaseDate as PartialDate | null}
              change={(v) => field('releaseDate', v ?? null)}
            />
            <LinkFields
              t={t}
              value={(fields().externalLinks as readonly ExternalLink[]) ?? []}
              change={(v) => field('externalLinks', v)}
            />
            <IdentityFields
              t={t}
              value={(fields().externalIdentities as readonly ExternalIdentity[]) ?? []}
              change={(v) => field('externalIdentities', v)}
            />
            <MarkdownField
              api={api}
              images={images}
              value={(fields().description as string | null) ?? ''}
              change={(v) => field('description', v || null)}
            />
            <ImageField
              api={api}
              images={images}
              value={(fields().primaryImageId as string | null) ?? null}
              preview={preview()}
              label={t('library.fields.primaryImageId')}
              change={(id, url) => {
                field('primaryImageId', id)
                setPreview(url)
              }}
            />
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
    </>
  )
}
