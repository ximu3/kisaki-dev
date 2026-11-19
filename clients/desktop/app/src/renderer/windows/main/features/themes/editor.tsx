/** @fileoverview Edits complete visual branches and coordinates explicit preview, save and selection. */

import { createSignal, onCleanup, Show } from 'solid-js'
import type { TokenName } from '@kisaki3/desktop-appearance/tokens'
import {
  parseUserThemeUpdate,
  type ColorScheme,
  type UserAppearanceTokens,
  type UserThemeCreate,
  type ThemeRef,
  type UserThemeUpdate,
} from '@kisaki3/desktop-contracts/appearance'
import { Button } from '@kisaki3/desktop-ui/button'
import { DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@kisaki3/desktop-ui/dialog'
import { Field, FieldLabel } from '@kisaki3/desktop-ui/field'
import { createForm, Form, FormFeedback, type FieldIssue } from '@kisaki3/desktop-ui/form'
import { Input } from '@kisaki3/desktop-ui/input'
import { SegmentedControl } from '@kisaki3/desktop-ui/segmented-control'
import { Toolbar, ToolbarRow } from '@kisaki3/desktop-ui/toolbar'
import { Switch } from '@kisaki3/desktop-ui/switch'
import { Alert } from '@kisaki3/desktop-ui/alert'
import { errorMessage } from '../../../../infrastructure/notifications'
import type { MainClient } from '../../../../infrastructure/api'
import type { EditorGuard } from '../../../../infrastructure/dialogs/closing'
import { createThemePreview } from './preview'
import { createFontOptions } from '../../domain-ui/fonts/options'
import { ThemeFields, themeGroups } from './fields'

/** A complete editable definition and the saved identity it compares against. */
export interface ThemeEdit {
  id: string | null
  definition: UserThemeCreate
}

/** Returns the independently changed properties and their original values. */
function themeUpdate(value: UserThemeCreate, original: UserThemeCreate): UserThemeUpdate {
  function difference<T extends object>(next: T, old: T) {
    const keys = Object.keys(next) as (keyof T)[]
    const changes: Partial<T> = {},
      expected: Partial<T> = {}
    for (const key of keys) {
      if (JSON.stringify(next[key]) === JSON.stringify(old[key])) {
        continue
      }
      changes[key] = next[key]
      expected[key] = old[key]
    }
    return { changes, expected }
  }

  const light = difference(value.light, original.light)
  const dark = difference(value.dark, original.dark)
  return {
    changes: {
      ...(value.name !== original.name && { name: value.name }),
      ...(Object.keys(light.changes).length && { light: light.changes }),
      ...(Object.keys(dark.changes).length && { dark: dark.changes }),
    },
    expected: {
      ...(value.name !== original.name && { name: original.name }),
      ...(Object.keys(light.expected).length && { light: light.expected }),
      ...(Object.keys(dark.expected).length && { dark: dark.expected }),
    },
  }
}

/** Holds one theme draft and releases only the application preview this instance acquired. */
export function ThemeEditor(props: {
  api: MainClient
  initial: ThemeEdit
  bind: (guard: EditorGuard) => void
  cancel: () => void
  saved: (ref: ThemeRef) => void
}) {
  const { api } = props
  const [draft, setDraft] = createSignal(props.initial.definition)
  const [original, setOriginal] = createSignal(props.initial)
  const [scheme, setScheme] = createSignal<ColorScheme>('light')
  const dirty = () =>
    !original().id || JSON.stringify(draft()) !== JSON.stringify(original().definition)

  const fonts = createFontOptions(api)

  const preview = createThemePreview(api, () => ({
    colorScheme: scheme(),
    tokens: draft()[scheme()],
  }))
  let active = true
  onCleanup(() => {
    active = false
  })

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
      issues.push({ id: 'name', summary: api.t('runtime.enterName') })
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
              summary: api.t('runtime.invalidField', {
                field: api.t(`runtime.themeTokens.${name}`),
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
    queueMicrotask(() => document.getElementById('theme-field-' + id)?.focus())
  }
  function change<K extends TokenName>(key: K, value: UserAppearanceTokens[K]) {
    setDraft((current) => ({ ...current, [scheme()]: { ...current[scheme()], [key]: value } }))
  }

  async function save(submitter: HTMLElement | null) {
    const use =
      submitter instanceof HTMLButtonElement &&
      submitter.name === 'intent' &&
      submitter.value === 'use'
    const value = draft(),
      old = original()
    const selected = use ? (await api.call('preferences.get')).appearance.theme : undefined
    let id = old.id
    if (id) {
      const update = themeUpdate(value, old.definition)
      if (Object.keys(update.changes).length) {
        await api.call('themes.update', id, update)
      }
    } else {
      const ref = await api.call('themes.create', value)
      id = ref.id
    }
    if (active) {
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
            ? api.t('runtime.savedConflict')
            : api.t('runtime.savedNotApplied', {
                reason: cause instanceof Error ? cause.message : String(cause),
              }),
          { cause },
        )
      }
      preview.change(false)
    }

    if (active && draft() === value) {
      props.saved({ type: 'user', id })
    }
  }

  const form = createForm({ validate: inspect, locate, order: fieldOrder, onSubmit: save })
  const guard = { busy: form.busy, dirty, save: () => form.submit() }
  props.bind(guard)

  return (
    <>
      <DialogHeader closeLabel={api.t('actions.close')}>
        <DialogTitle>
          {api.t(props.initial.id ? 'runtime.editTheme' : 'runtime.newTheme')}
        </DialogTitle>
      </DialogHeader>
      <Form state={form}>
        <Toolbar band>
          <ToolbarRow class="items-end">
            <Field name="name" id="theme-field-name" required class="min-w-40 flex-1">
              <FieldLabel>{api.t('runtime.name')}</FieldLabel>
              <Input
                autofocus
                value={draft().name}
                onValueChange={(name) => setDraft((value) => ({ ...value, name }))}
              />
            </Field>
            <div class="flex flex-wrap items-end gap-x-4">
              <Field>
                <FieldLabel>{api.t('runtime.themeBranch')}</FieldLabel>
                <SegmentedControl
                  label={api.t('runtime.themeBranch')}
                  value={scheme()}
                  options={[
                    { value: 'light', label: api.t('runtime.light') },
                    { value: 'dark', label: api.t('runtime.dark') },
                  ]}
                  onValueChange={(value) => setScheme(value as ColorScheme)}
                />
              </Field>
              <Field class="flex-row items-center pb-0.5">
                <FieldLabel>{api.t('runtime.preview')}</FieldLabel>
                <Switch checked={preview.enabled()} onCheckedChange={preview.change} />
              </Field>
            </div>
          </ToolbarRow>
        </Toolbar>
        <DialogBody class="@container space-y-5">
          <Show when={fonts.error()}>
            {(cause) => (
              <Alert tone="destructive" role="alert">
                {errorMessage(cause())}{' '}
                <Button variant="outline" onClick={fonts.retry}>
                  {api.t('runtime.retry')}
                </Button>
              </Alert>
            )}
          </Show>
          <ThemeFields
            t={api.t}
            scheme={scheme()}
            values={draft()[scheme()]}
            users={fonts.users()}
            system={fonts.system()}
            loading={fonts.loading()}
            change={change}
          />
        </DialogBody>
        <DialogFooter>
          <FormFeedback summary={(count) => api.t('runtime.fieldErrors', { count })} />
          <Button variant="ghost" onClick={props.cancel}>
            {api.t('actions.cancel')}
          </Button>
          <Button type="submit" variant="outline" disabled={form.busy()}>
            {api.t('actions.save')}
          </Button>
          <Button type="submit" name="intent" value="use" disabled={form.busy()}>
            {api.t('runtime.saveUse')}
          </Button>
        </DialogFooter>
      </Form>
    </>
  )
}
