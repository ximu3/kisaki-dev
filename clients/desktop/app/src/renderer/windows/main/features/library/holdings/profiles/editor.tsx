import { createSignal, For, Show } from 'solid-js'
import { dequal } from 'dequal'
import { Button } from '@kisaki3/desktop-ui/button'
import { Checkbox } from '@kisaki3/desktop-ui/checkbox'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@kisaki3/desktop-ui/field'
import { createForm, Form, FormFeedback } from '@kisaki3/desktop-ui/form'
import { Input } from '@kisaki3/desktop-ui/input'
import { Textarea } from '@kisaki3/desktop-ui/textarea'
import { Select } from '@kisaki3/desktop-ui/select'
import {
  parseFileRecognitionDefinitionShape,
  type FileRecognitionPreset,
  type FileRecognitionProfile,
  type FileWorkType,
  type WorkRef,
} from '@kisaki3/desktop-contracts/library'
import type { MainClient } from '../../../../../../infrastructure/api'
import type { EditorGuard } from '../../../../../../infrastructure/dialogs/closing'
import { PresetButton, PresetPicker } from '../../../../domain-ui/library/presets'
import { libraryRead } from '../../../../domain-ui/library/read'
import { initialTarget, TargetEditor, type TargetDraft } from './target'
import { RecognitionTest } from './test'

export interface ProfileEdit {
  saved?: FileRecognitionProfile
  preset?: FileRecognitionPreset<FileWorkType>
  copy?: FileRecognitionProfile
}
interface RuleDraft {
  id: string
  name: string
  enabled: boolean
  input: 'baseName' | 'path'
  pattern: string
  ignoreCase: boolean
  output: { targets: readonly TargetDraft[] }
}
export function ProfileEditor(props: {
  api: MainClient
  work: WorkRef<FileWorkType>
  edit: ProfileEdit
  presets: readonly FileRecognitionPreset<FileWorkType>[]
  register: (guard: EditorGuard) => void
  close: () => void
  saved: () => void
}) {
  const { api, edit, work } = props,
    t = api.t,
    original = edit.saved ?? edit.copy
  const initial = {
    name: original?.name ?? edit.preset?.name ?? '',
    description: original?.description ?? edit.preset?.description ?? '',
    definition:
      original?.definition.status === 'ready'
        ? original.definition.value
        : (edit.preset?.definition ?? { rules: [] }),
  }
  const [name, setName] = createSignal(initial.name),
    [description, setDescription] = createSignal(initial.description),
    [rules, setRules] = createSignal<readonly RuleDraft[]>(initial.definition.rules)
  const [presets, setPresets] = createSignal(false),
    [test, setTest] = createSignal(false)
  const refs = libraryRead(api, ['holdings'], (signal) =>
    edit.saved ? api.request(signal, 'library.profiles.references', work.type, edit.saved.id) : [],
  )
  const definition = () => parseFileRecognitionDefinitionShape(work.type, { rules: rules() })
  const dirty = () =>
    name() !== initial.name ||
    description() !== initial.description ||
    !dequal(rules(), initial.definition.rules)
  const form = createForm({
    validate: () => (name().trim() ? [] : [{ id: 'name', summary: t('forms.enterName') }]),
    onSubmit: async () => {
      const fields = {
        name: name().trim(),
        description: description().trim() || null,
        definition: definition(),
      }
      if (edit.saved) {
        const saved = edit.saved,
          changedRules =
            saved.definition.status !== 'ready' || !dequal(fields.definition, initial.definition)
        await api.call('library.profiles.update', work.type, saved.id, {
          changes: {
            ...(fields.name !== saved.name && { name: fields.name }),
            ...(fields.description !== saved.description && { description: fields.description }),
            ...(changedRules && { definition: fields.definition }),
          },
          expected: {
            ...(fields.name !== saved.name && { name: saved.name }),
            ...(fields.description !== saved.description && { description: saved.description }),
            ...(changedRules &&
              saved.definition.status === 'ready' && { definition: saved.definition.value }),
          },
        })
      } else {
        await api.call('library.profiles.create', work.type, fields)
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
  function append() {
    setRules((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        name: '',
        enabled: true,
        input: 'baseName',
        pattern: '',
        ignoreCase: false,
        output: { targets: [initialTarget(work.type === 'anime' ? 'episode' : 'volume')] },
      },
    ])
  }
  function change(id: string, fields: Partial<RuleDraft>) {
    setRules((list) => list.map((r) => (r.id === id ? { ...r, ...fields } : r)))
  }
  function move(id: string, delta: number) {
    setRules((list) => {
      const next = [...list],
        i = next.findIndex((r) => r.id === id)
      if (i + delta >= 0 && i + delta < list.length) {
        ;[next[i], next[i + delta]] = [next[i + delta]!, next[i]!]
      }
      return next
    })
  }
  return (
    <>
      <DialogHeader closeLabel={t('actions.close')}>
        <DialogTitle>{t('library.holdings.profile')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <DialogBody>
          <FieldGroup>
            <div class="flex items-end gap-2">
              <Field class="grow">
                <FieldLabel>{t('library.holdings.profileName')}</FieldLabel>
                <Input autofocus value={name()} onValueChange={setName} />
              </Field>
              <PresetButton t={t} open={() => setPresets(true)} />
            </div>
            <Field>
              <FieldLabel>{t('library.fields.description')}</FieldLabel>
              <Textarea value={description()} onValueChange={setDescription} />
            </Field>
            <Show when={edit.saved}>
              <div class="text-sm">
                <span>
                  {t('library.ruleEditor.references')} · {refs.result()?.value?.length ?? 0}
                </span>
                <For each={refs.result()?.value}>
                  {(ref) => <p class="break-all text-xs">{ref.path}</p>}
                </For>
              </div>
            </Show>
            <For each={rules().map((r) => r.id)}>
              {(id, index) => {
                const row = () => rules()[index()]!,
                  targets = (v: readonly TargetDraft[]) => change(id, { output: { targets: v } })
                return (
                  <section class="space-y-2 rounded border p-3">
                    <div class="flex items-end gap-2">
                      <Field class="grow">
                        <FieldLabel>{t('library.holdings.ruleName')}</FieldLabel>
                        <Input value={row().name} onValueChange={(name) => change(id, { name })} />
                      </Field>
                      <For each={[-1, 1]}>
                        {(d) => (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={index() + d < 0 || index() + d >= rules().length}
                            onClick={() => move(id, d)}
                          >
                            {t(d < 0 ? 'actions.moveUp' : 'actions.moveDown')}
                          </Button>
                        )}
                      </For>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRules((list) => list.filter((r) => r.id !== id))}
                      >
                        {t('actions.remove')}
                      </Button>
                    </div>
                    <label class="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={row().enabled}
                        onCheckedChange={(enabled) => change(id, { enabled })}
                      />
                      {t('showcase.enabled')}
                    </label>
                    <Field>
                      <FieldLabel>{t('library.holdings.input')}</FieldLabel>
                      <Select
                        emptyMessage={t('controls.search.empty')}
                        invalidSelectionMessage={t('controls.feedback.unavailable')}
                        options={(['baseName', 'path'] as const).map((value) => ({
                          value,
                          label: t(`library.holdings.${value}`),
                        }))}
                        value={row().input}
                        onValueChange={(v) => {
                          if (v === 'baseName' || v === 'path') {
                            change(id, { input: v })
                          }
                        }}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>{t('library.holdings.pattern')}</FieldLabel>
                      <Input
                        value={row().pattern}
                        onValueChange={(pattern) => change(id, { pattern })}
                      />
                    </Field>
                    <label class="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={row().ignoreCase}
                        onCheckedChange={(ignoreCase) => change(id, { ignoreCase })}
                      />
                      {t('library.holdings.ignoreCase')}
                    </label>
                    <For each={row().output.targets.map((_, i) => i)}>
                      {(i) => (
                        <TargetEditor
                          t={t}
                          type={work.type}
                          target={row().output.targets[i]!}
                          update={(v) =>
                            targets(
                              row().output.targets.map((before, index) =>
                                index === i ? v : before,
                              ),
                            )
                          }
                          remove={
                            row().output.targets.length > 1
                              ? () =>
                                  targets(row().output.targets.filter((_, index) => i !== index))
                              : undefined
                          }
                        />
                      )}
                    </For>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        targets([
                          ...row().output.targets,
                          initialTarget(work.type === 'anime' ? 'episode' : 'volume'),
                        ])
                      }
                    >
                      {t('library.ruleEditor.addTarget')}
                    </Button>
                  </section>
                )
              }}
            </For>
            <div class="flex gap-2">
              <Button variant="outline" onClick={append}>
                {t('library.ruleEditor.addRule')}
              </Button>
              <Button
                variant="outline"
                aria-expanded={test() ? 'true' : 'false'}
                onClick={() => setTest((v) => !v)}
              >
                {t('library.holdings.test')}
              </Button>
            </div>
            <Show when={test()}>
              <RecognitionTest api={api} work={work} definition={definition} />
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
          items={props.presets}
          multiple={false}
          close={() => setPresets(false)}
          apply={(items) => {
            const item = items[0]
            if (item) {
              setRules(item.definition.rules)
            }
          }}
        />
      </Show>
    </>
  )
}
