import { onSettled, getOwner, isDisposed, createMemo, createSignal } from 'solid-js'
import type { TokenName } from '@kisaki3/desktop-appearance/tokens'
import {
  parseUserThemeUpdate,
  type ColorScheme,
  type UserAppearanceTokens,
  type ThemeRef,
} from '@kisaki3/desktop-contracts/appearance'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { createForm, Form, FormFeedback, type FieldIssue } from '@kisaki3/desktop-ui/form'
import { Input } from '@kisaki3/desktop-ui/input'
import { SegmentedControl } from '@kisaki3/desktop-ui/segmented-control'
import { Toolbar, ToolbarRow } from '@kisaki3/desktop-ui/toolbar'
import { Switch } from '@kisaki3/desktop-ui/switch'
import type { MainClient } from '../../../../infrastructure/api'
import type { EditorGuard } from '../../../../infrastructure/dialogs/closing'
import { themeUpdate, type ThemeEdit } from './draft'
import { createThemePreview } from './preview'
import { ThemeFields, themeGroups } from './fields'

interface ThemeEditorProps {
  api: MainClient
  initial: ThemeEdit
  registerEditor: (guard: EditorGuard) => void
  requestClose: () => void
  onSaved: (ref: ThemeRef) => void
}

export function ThemeEditor(props: ThemeEditorProps) {
  const { api } = props
  const [draft, setDraft] = createSignal(props.initial.definition)
  const [original, setOriginal] = createSignal(props.initial)
  const [scheme, setScheme] = createSignal<ColorScheme>('light')
  const update = createMemo(() => themeUpdate(draft(), original().definition))
  const dirty = () => Object.keys(update().changes).length > 0

  const preview = createThemePreview(api, () => ({
    colorScheme: scheme(),
    tokens: draft()[scheme()],
  }))
  const owner = getOwner()!

  const fieldOrder = () => [
    'name',
    ...(['light', 'dark'] as const).flatMap((branch) =>
      themeGroups.flatMap((group) => group.names.map((name) => branch + '/--' + name)),
    ),
  ]
  function inspect(): FieldIssue[] {
    const value = draft()
    const issues: FieldIssue[] = []
    if (!value.name.trim()) {
      issues.push({ id: 'name', summary: api.t('forms.enterName') })
    }
    for (const branch of ['light', 'dark'] as const) {
      for (const group of themeGroups) {
        for (const name of group.names) {
          const key = `--${name}` as const
          try {
            parseUserThemeUpdate({ changes: { [branch]: { [key]: value[branch][key] } } })
          } catch {
            issues.push({
              id: branch + '/' + key,
              summary: api.t('forms.invalidField', {
                field: api.t(`themes.tokens.${name}`),
              }),
            })
          }
        }
      }
    }
    return issues
  }
  function locate(id: string) {
    if (id !== 'name') {
      setScheme(id.startsWith('light/') ? 'light' : 'dark')
    }
    onSettled(() => document.getElementById('theme-field-' + id)?.focus())
  }
  function change<K extends TokenName>(key: K, value: UserAppearanceTokens[K]) {
    setDraft((current) => ({ ...current, [scheme()]: { ...current[scheme()], [key]: value } }))
  }

  async function save(submitter: HTMLElement | null) {
    const use =
      submitter instanceof HTMLButtonElement &&
      submitter.name === 'intent' &&
      submitter.value === 'use'
    const value = draft()
    const edits = update()
    let id = original().id
    const selected = use ? (await api.call('preferences.get')).appearance.theme : undefined
    if (id) {
      if (Object.keys(edits.changes).length) {
        await api.call('themes.update', id, edits)
      }
    } else {
      const ref = await api.call('themes.create', value)
      id = ref.id
    }
    if (!isDisposed(owner)) {
      setOriginal({ id, definition: value })
    }

    if (use) {
      try {
        await api.call('preferences.update', {
          changes: { appearance: { theme: { type: 'user', id } } },
          ...(selected?.status === 'ready' && {
            expected: { appearance: { theme: selected.value } },
          }),
        })
      } catch (cause) {
        const conflict = cause instanceof Error && 'code' in cause && cause.code === 'Conflict'
        throw new Error(
          conflict
            ? api.t('themes.savedConflict')
            : api.t('themes.savedNotApplied', {
                reason: cause instanceof Error ? cause.message : String(cause),
              }),
          { cause },
        )
      }
      preview.change(false)
    }

    if (!isDisposed(owner) && draft() === value) {
      props.onSaved({ type: 'user', id })
    }
  }

  const form = createForm({ validate: inspect, locate, order: fieldOrder, onSubmit: save })
  props.registerEditor({
    pending: () => (form.busy() ? form.submit() : undefined),
    dirty,
    save: form.submit,
    currentFormAction: () => (original().id === null ? form.submit : undefined),
  })

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>{api.t(props.initial.id ? 'themes.edit' : 'themes.create')}</DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <Toolbar band>
          <ToolbarRow class="items-end">
            <Field name="name" id="theme-field-name" required class="min-w-40 flex-1">
              <FieldLabel>{api.t('forms.name')}</FieldLabel>
              <Input
                autofocus
                value={draft().name}
                onValueChange={(name) => setDraft((value) => ({ ...value, name }))}
              />
            </Field>
            <div class="flex flex-wrap items-end gap-x-4">
              <Field>
                <FieldLabel>{api.t('themes.scheme')}</FieldLabel>
                <SegmentedControl
                  label={api.t('themes.scheme')}
                  value={scheme()}
                  options={[
                    { value: 'light', label: api.t('appearance.modes.light') },
                    { value: 'dark', label: api.t('appearance.modes.dark') },
                  ]}
                  onValueChange={(value) => setScheme(value as ColorScheme)}
                />
              </Field>
              <Field class="flex-row items-center pb-0.5">
                <FieldLabel>{api.t('actions.preview')}</FieldLabel>
                <Switch checked={preview.enabled()} onCheckedChange={preview.change} />
              </Field>
            </div>
          </ToolbarRow>
        </Toolbar>
        <DialogBody class="@container space-y-5">
          <ThemeFields
            t={api.t}
            scheme={scheme()}
            values={draft()[scheme()]}
            api={api}
            change={change}
          />
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => api.t('forms.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.requestClose}>
            {api.t('actions.cancel')}
          </Button>
          <Button type="submit" variant="outline" disabled={form.busy()}>
            {api.t('actions.save')}
          </Button>
          <Button type="submit" name="intent" value="use" disabled={form.busy()}>
            {api.t('themes.saveAndUse')}
          </Button>
        </DialogFooter>
      </Form>
    </>
  )
}
