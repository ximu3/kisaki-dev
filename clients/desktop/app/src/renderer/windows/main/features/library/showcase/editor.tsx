import { createSignal, Show } from 'solid-js'
import { dequal } from 'dequal'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { Form, FormFeedback, createForm } from '@kisaki3/desktop-ui/form'
import { Input, NumberInput } from '@kisaki3/desktop-ui/input'
import { Select } from '@kisaki3/desktop-ui/select'
import { Switch } from '@kisaki3/desktop-ui/switch'
import {
  parseShowcaseFields,
  type ShowcaseFields,
  type ShowcasePreset,
  type ShowcaseQuery,
  type ShowcaseUpdate,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../infrastructure/dialogs/closing'
import { PresetButton, PresetPicker } from '../../../domain-ui/library/presets'
import { RuleGroups, ScopeField } from '../../../domain-ui/library/entries/filters/rules'
import { initialSection, presetChoices, type SectionEdit } from './model'

export function SectionEditor(props: {
  api: MainClient
  edit: SectionEdit
  presets: readonly ShowcasePreset[]
  register: (guard: EditorGuard) => void
  close: () => void
  saved: () => void
}) {
  const { api } = props
  const t = api.t
  const saved = props.edit.saved
  const defaults = initialSection()
  const initial: ShowcaseFields = saved
    ? {
        name: saved.name,
        layout: saved.layout,
        itemSize: saved.itemSize,
        openMode: saved.openMode,
        isVisible: saved.isVisible,
        limit: saved.limit,
        query: saved.query.status === 'ready' ? saved.query.value : defaults.query,
      }
    : defaults
  const [draft, setDraft] = createSignal(initial)
  const [editingQuery, setEditingQuery] = createSignal(saved?.query.status !== 'invalid')
  const [presets, setPresets] = createSignal(false)
  const [limit, setLimit] = createSignal(initial.limit?.toString() ?? '')
  const choices = {
    emptyMessage: t('controls.search.empty'),
    invalidSelectionMessage: t('controls.feedback.unavailable'),
  }
  const dirty = () =>
    !dequal(draft(), initial) ||
    limit() !== (initial.limit?.toString() ?? '') ||
    (saved?.query.status === 'invalid' && editingQuery())
  function field<K extends keyof ShowcaseFields>(key: K, value: ShowcaseFields[K]) {
    setDraft((row) => ({ ...row, [key]: value }))
  }
  function changeQuery(query: ShowcaseQuery) {
    setEditingQuery(true)
    field('query', query)
  }
  function kind(value: ShowcaseQuery['kind']) {
    if (value === draft().query.kind) {
      return
    }
    changeQuery(
      value === 'entry'
        ? initialSection().query
        : { kind: value, sort: { type: 'scope' }, search: '' },
    )
  }
  const form = createForm({
    validate: () => (draft().name.trim() ? [] : [{ id: 'name', summary: t('forms.enterName') }]),
    onSubmit: async () => {
      const value = parseShowcaseFields({
        ...draft(),
        limit: limit() === '' ? null : Number(limit()),
      })
      if (saved) {
        const changes: Record<string, unknown> = {}
        const expected: Record<string, unknown> = {}
        for (const key of [
          'name',
          'layout',
          'itemSize',
          'openMode',
          'limit',
          'isVisible',
        ] as const) {
          if (value[key] !== initial[key]) {
            changes[key] = value[key]
            expected[key] = initial[key]
          }
        }
        if (
          editingQuery() &&
          (saved.query.status === 'invalid' || !dequal(initial.query, value.query))
        ) {
          changes.query = value.query
          if (saved.query.status === 'ready') {
            expected.query = initial.query
          }
        }
        await api.call('library.showcase.update', saved.id, {
          changes,
          expected,
        } satisfies ShowcaseUpdate)
      } else {
        await api.call('library.showcase.create', value)
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

  const entry = () => {
    const q = draft().query
    return q.kind === 'entry' ? q : undefined
  }
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{t(saved ? 'showcase.editSection' : 'showcase.newSection')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody>
          <FieldGroup>
            <div class="flex items-end gap-2">
              <Field class="grow" name="name" required>
                <FieldLabel>{t('forms.name')}</FieldLabel>
                <Input autofocus value={draft().name} onValueChange={(v) => field('name', v)} />
              </Field>
              <PresetButton t={t} open={() => setPresets(true)} />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>{t('showcase.query')}</FieldLabel>
                <Select
                  {...choices}
                  value={draft().query.kind}
                  options={(['entry', 'collection', 'tag'] as const).map((value) => ({
                    value,
                    label: t(
                      (
                        {
                          entry: 'library.pages.entries',
                          collection: 'library.pages.collections',
                          tag: 'library.pages.tags',
                        } as const
                      )[value],
                    ),
                  }))}
                  onValueChange={(v) => {
                    if (v) {
                      kind(v)
                    }
                  }}
                />
              </Field>
              <Field>
                <label class="flex items-center justify-between text-sm">
                  {t('showcase.show')}
                  <Switch
                    checked={draft().isVisible}
                    onCheckedChange={(visible) => field('isVisible', visible)}
                  />
                </label>
                <FieldLabel>{t('showcase.layout')}</FieldLabel>
                <Select
                  {...choices}
                  value={draft().layout}
                  options={(['horizontal', 'grid'] as const).map((value) => ({
                    value,
                    label: t(`showcase.${value}`),
                  }))}
                  onValueChange={(v) => {
                    if (v) {
                      field('layout', v)
                    }
                  }}
                />
              </Field>
              <Field>
                <FieldLabel>{t('showcase.openMode')}</FieldLabel>
                <Select
                  {...choices}
                  value={draft().openMode}
                  options={(['page', 'dialog'] as const).map((value) => ({
                    value,
                    label: t(`showcase.${value}`),
                  }))}
                  onValueChange={(v) => {
                    if (v) {
                      field('openMode', v)
                    }
                  }}
                />
              </Field>
              <Field>
                <FieldLabel>{t('showcase.size')}</FieldLabel>
                <Select
                  {...choices}
                  value={draft().itemSize}
                  options={(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((value) => ({
                    value,
                    label: value.toUpperCase(),
                  }))}
                  onValueChange={(v) => {
                    if (v) {
                      field('itemSize', v)
                    }
                  }}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>{t('showcase.limit')}</FieldLabel>
              <NumberInput
                min={1}
                step={1}
                value={limit()}
                onValueChange={setLimit}
                placeholder={t('showcase.unlimited')}
                increaseLabel={t('controls.number.increase')}
                decreaseLabel={t('controls.number.decrease')}
              />
            </Field>
            <Field>
              <FieldLabel>{t('controls.search.label')}</FieldLabel>
              <Input
                value={draft().query.search}
                onValueChange={(search) => changeQuery({ ...draft().query, search })}
              />
            </Field>
            <Show when={entry()}>
              {(q) => (
                <>
                  <ScopeField
                    api={api}
                    value={q().scope}
                    change={(scope) => changeQuery({ ...q(), scope })}
                  />
                  <RuleGroups
                    api={api}
                    value={q()}
                    change={(value) => changeQuery({ ...q(), ...value })}
                  />
                </>
              )}
            </Show>
          </FieldGroup>
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
      <Show when={presets()}>
        <PresetPicker
          t={t}
          multiple={false}
          items={presetChoices(props.presets, api.locale())}
          close={() => setPresets(false)}
          apply={([selected]) => {
            if (selected) {
              setDraft(selected.preset.initial)
              setLimit(selected.preset.initial.limit?.toString() ?? '')
              setEditingQuery(true)
            }
          }}
        />
      </Show>
    </>
  )
}
