/** @fileoverview Edits grouped preference drafts and commits only changed fields with their original baselines. */

import {
  createEffect,
  createSignal,
  createResource,
  For,
  Show,
  onCleanup,
  Switch,
  Match,
} from 'solid-js'
import { ShortcutRecorder } from './recorder'
import { matchesShortcut } from '../../../../infrastructure/shortcuts'
import { FontSelector, listFontOptions } from '../../domain-ui/fonts/selection'
import { Button } from '@kisaki3/desktop-ui/button'
import { preferenceKeys, type PreferenceKey } from '@kisaki3/desktop-contracts/preferences'
import type { englishMessages } from '@kisaki3/desktop-localization'
import { fieldPath, fieldValue, editField, updateInput, type FieldEdit } from './draft'
import type { MainClient } from '../../../../infrastructure/api'

/** Fixed enumerations shown by the corresponding typed preference field. */
const choices: Record<string, readonly string[]> = {
  closeMainWindow: ['background', 'quit'],
  mode: ['system', 'light', 'dark'],
  flow: ['paginated', 'continuous'],
  arrangement: ['single', 'spread'],
  progression: ['document', 'ltr', 'rtl'],
  firstPage: ['single', 'paired'],
  fit: ['page', 'width', 'height'],
  writingMode: ['document', 'horizontal-tb', 'vertical-rl', 'vertical-lr'],
  alignment: ['document', 'start', 'justify'],
}

/** Dialog body whose resource-management routes preserve this editor's separate draft. */
export function PreferenceEditor(props: {
  field?: PreferenceKey | undefined
  active: boolean
  api: MainClient
  onSave: (save: () => Promise<void>) => void
  dirty: (changed: boolean) => void
  manage: (page: 'themes' | 'fonts') => void
  report: (error: unknown) => void
}) {
  const { api } = props
  /** Tracks the displayed section independently of the common draft. */
  const [group, setGroup] = createSignal('general')
  /** Stores each dirty field with its first editing baseline. */
  const [edits, setEdits] = createSignal<FieldEdit[]>([])
  /** Rereads durable values while the dirty fields retain their own originals. */
  const [saved, { refetch, mutate }] = createResource(() => api.call('preferences.get'))
  /** Reads complete product defaults for an explicit section reset. */
  const [defaults] = createResource(() => api.call('preferences.defaults'))
  /** Reads native names and stable translation identities. */
  const [translations, { refetch: reloadTranslations }] = createResource(() =>
    api.call('translations.list'),
  )
  /** Keeps the theme selector current after independent resource saves. */
  const [themes, { refetch: reloadThemes }] = createResource(() => api.call('themes.list'))
  /** Keeps user font choices current after returning from the font library. */
  const [fonts, { refetch: reloadFonts }] = createResource(() => listFontOptions(api))
  /** Requests actual system families for the reading-font selector. */
  const [systemFonts] = createResource(
    () => group() === 'usage',
    () =>
      api.call('fonts.system').catch((cause) => {
        props.report(cause)
        return []
      }),
  )
  /** Reads route adoption separately from a successful preference save. */
  const [network, { refetch: reloadNetwork }] = createResource(() => api.call('network.state'))
  /** Refreshes saved values and network readiness without clearing edits. */
  const invalidated = () => {
    void refetch()
    void reloadNetwork()
    void reloadThemes()
  }
  /** Refreshes theme identities after the directory changes. */
  const themeChange = () => void reloadThemes()
  /** Refreshes available user fonts after the directory changes. */
  const fontChange = () => void reloadFonts()
  api.topics.addEventListener('window.changed', invalidated)
  api.topics.addEventListener('themes.changed', themeChange)
  /** Refreshes the catalog even when the added translation is not currently selected. */
  const translationsChanged = () => void reloadTranslations()
  api.topics.addEventListener('translations.changed', translationsChanged)
  api.topics.addEventListener('fonts.changed', fontChange)
  onCleanup(() => {
    api.topics.removeEventListener('window.changed', invalidated)
    api.topics.removeEventListener('themes.changed', themeChange)
    api.topics.removeEventListener('translations.changed', translationsChanged)
    api.topics.removeEventListener('fonts.changed', fontChange)
  })
  /** Replaces the current edit list and informs the window close guard. */
  const set = (value: FieldEdit[]) => {
    setEdits(value)
    props.dirty(value.length > 0)
  }
  /** Resolves the edited value before consulting the saved snapshot. */
  const value = (path: string[]) => {
    const edit = edits().find((edit) => JSON.stringify(edit.path) === JSON.stringify(path))
    return edit ? edit.value : fieldValue(saved(), path)
  }
  /** Changes one field while retaining its first comparison baseline. */
  const edit = (path: string[], next: unknown) => set(editField(edits(), saved()!, path, next))
  /** Formats a native preference field label in the effective language. */
  const label = (key: string) =>
    api.t(
      ...(['runtime.fields.' + key] as {
        [K in keyof typeof englishMessages.runtime.fields]: [`runtime.fields.${K}`]
      }[keyof typeof englishMessages.runtime.fields]),
    )
  /** Formats an enumeration choice without changing its saved identifier. */
  const choice = (key: string) =>
    api.t(
      ('runtime.choices.' +
        key) as `runtime.choices.${keyof typeof englishMessages.runtime.choices}`,
    )
  /** Prevents duplicate commits while the preference save is in progress. */
  const [busy, setBusy] = createSignal(false)
  /** Checks and commits all dirty groups as one preference edit. */
  const save = async () => {
    setBusy(true)
    try {
      mutate(await api.call('preferences.update', updateInput(edits())))
      set([])
    } finally {
      setBusy(false)
    }
  }
  props.onSave(save)
  /** Replaces only this section's draft with its current defaults. */
  const reset = () => {
    const base = defaults()
    if (!base || !saved()) {
      return
    }
    let changed = edits()
    for (const key of preferenceKeys) {
      if (!key.startsWith(group() + '.')) {
        continue
      }
      const path = fieldPath(key)
      const fields = key.startsWith('shortcuts.')
        ? [
            [...path, 'enabled'],
            [...path, 'accelerators'],
          ]
        : [path]
      for (const field of fields) {
        changed = editField(changed, saved()!, field, fieldValue(base, field))
      }
    }
    set(changed)
  }
  /** Handles the configured save binding for the active editor only. */
  const keyHandler = (event: KeyboardEvent) => {
    if (
      props.active &&
      matchesShortcut(event, saved()?.shortcuts['editor.save'], api.platform) &&
      edits().length
    ) {
      event.preventDefault()
      void save().catch(props.report)
    }
  }
  window.addEventListener('keydown', keyHandler)
  onCleanup(() => window.removeEventListener('keydown', keyHandler))
  let focused: PreferenceKey | undefined
  createEffect(() => {
    const key = props.field
    if (!key) {
      focused = undefined
      return
    }
    if (focused === key || !saved()) {
      return
    }
    focused = key
    setGroup(fieldPath(key)[0]!)
    queueMicrotask(() => {
      const row = document.getElementById('preference-' + key)
      row?.scrollIntoView({ block: 'nearest' })
      row?.querySelector<HTMLElement>('input,button,select')?.focus()
    })
  })
  const groups = [
    'general',
    'appearance',
    'navigation',
    'library',
    'usage',
    'shortcuts',
    'network',
    'updates',
  ]
  /** Holds the unsubmitted proxy password in this editor's memory. */
  const [password, setPassword] = createSignal('')
  /** Holds the unsubmitted proxy username until explicit replacement. */
  const [username, setUsername] = createSignal('')
  /** Builds the control for the semantic type of a stable preference key. */
  function control(key: PreferenceKey) {
    const path = fieldPath(key)
    const leaf = path.at(-1)!
    /** Reads the effective draft value for this control. */
    const current = () => value(path)
    /** Replaces the entire editing unit represented by this control. */
    const change = (v: unknown) => edit(path, v)
    const list = key === 'network.mode' ? ['system', 'direct', 'manual'] : choices[leaf]
    /** Displays stable resource identities and preserves an unavailable selection. */
    const selectRef = (items: readonly { ref: unknown; name: unknown }[]) => {
      /** Encodes the currently selected identity for its option key. */
      const serial = () => JSON.stringify(current())
      return (
        <select
          aria-label={label(leaf)}
          value={serial()}
          onChange={(e) => change(JSON.parse(e.currentTarget.value))}
        >
          <Show when={!items.some((item) => JSON.stringify(item.ref) === serial())}>
            <option value={serial()}>{api.t('runtime.unavailable')}</option>
          </Show>
          <For each={items}>
            {(item) => (
              <option value={JSON.stringify(item.ref)}>
                {typeof item.name === 'string' ? item.name : JSON.stringify(item.name)}
              </option>
            )}
          </For>
        </select>
      )
    }
    if (key.startsWith('shortcuts.')) {
      return (
        <div class="tool-row">
          <input
            type="checkbox"
            aria-label={label('enabled')}
            checked={Boolean(value([...path, 'enabled']))}
            onInput={(e) => edit([...path, 'enabled'], e.currentTarget.checked)}
          />
          <ShortcutRecorder
            api={api}
            keys={(value([...path, 'accelerators']) as string[] | undefined) ?? []}
            change={(keys) => edit([...path, 'accelerators'], keys)}
          />
        </div>
      )
    }
    if (key === 'general.uiTranslation') {
      return selectRef(translations() ?? [])
    }
    if (key === 'appearance.theme') {
      return (
        <div>
          {selectRef(themes() ?? [])}
          <Button variant="ghost" onClick={() => props.manage('themes')}>
            {api.t('runtime.manageThemes')}
          </Button>
        </div>
      )
    }
    if (key === 'network.credentials') {
      return (
        <div class="secret">
          <span>{current() ? api.t('runtime.configured') : api.t('runtime.none')}</span>
          <input
            aria-label={api.t('runtime.username')}
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            autocomplete="off"
          />
          <input
            type="password"
            aria-label={api.t('runtime.password')}
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            autocomplete="new-password"
          />
          <Button
            onClick={() => {
              change({ username: username(), password: password() })
              setPassword('')
            }}
          >
            {api.t('runtime.replace')}
          </Button>
          <Button variant="ghost" onClick={() => change(null)}>
            {api.t('runtime.clearCredentials')}
          </Button>
        </div>
      )
    }
    if (leaf === 'order') {
      return (
        <ol class="order">
          <For each={current() as { type: string; id?: string; pageId?: string }[]}>
            {(page, i) => (
              <li>
                {page.id ?? page.pageId}
                <Button
                  variant="ghost"
                  disabled={!i()}
                  onClick={() => {
                    const next = [...(current() as unknown[])]
                    ;[next[i() - 1], next[i()]] = [next[i()], next[i() - 1]]
                    change(next)
                  }}
                >
                  {api.t('runtime.moveUp')}
                </Button>
              </li>
            )}
          </For>
        </ol>
      )
    }
    if (leaf === 'colors') {
      /** Reads the reading editor's complete tagged color choice. */
      const color = () => current() as { type: string; foreground?: string; background?: string }
      return (
        <div>
          <select
            aria-label={label(leaf)}
            value={color().type}
            onChange={(e) =>
              change(
                e.currentTarget.value === 'custom'
                  ? { type: 'custom', foreground: '#222222', background: '#ffffff' }
                  : { type: e.currentTarget.value },
              )
            }
          >
            <For each={['document', 'theme', 'custom']}>
              {(v) => <option value={v}>{choice(v)}</option>}
            </For>
          </select>
          <Show when={color().type === 'custom'}>
            <For each={['foreground', 'background'] as const}>
              {(k) => (
                <input
                  aria-label={k}
                  value={color()[k] ?? ''}
                  onInput={(e) => change({ ...color(), [k]: e.currentTarget.value })}
                />
              )}
            </For>
          </Show>
        </div>
      )
    }
    if (leaf === 'font') {
      return (
        <div>
          <FontSelector
            api={api}
            label={label(leaf)}
            fallback="document"
            value={current()}
            change={change}
            users={fonts() ?? []}
            system={systemFonts() ?? []}
          />
          <Button variant="ghost" onClick={() => props.manage('fonts')}>
            {api.t('runtime.manageFonts')}
          </Button>
        </div>
      )
    }
    if (list) {
      return (
        <select
          aria-label={label(leaf)}
          value={String(current())}
          onChange={(e) => change(e.currentTarget.value)}
        >
          <For each={list}>{(v) => <option value={v}>{choice(v)}</option>}</For>
        </select>
      )
    }
    if (leaf === 'paragraphSpacing') {
      return (
        <input
          aria-label={label(leaf)}
          value={String(current())}
          onInput={(e) =>
            change(
              e.currentTarget.value === 'document' ? 'document' : Number(e.currentTarget.value),
            )
          }
        />
      )
    }
    return (
      <Switch
        fallback={
          <input
            aria-label={label(leaf)}
            value={typeof current() === 'string' ? (current() as string) : ''}
            onInput={(e) =>
              change(leaf === 'endpoint' && !e.currentTarget.value ? null : e.currentTarget.value)
            }
          />
        }
      >
        <Match when={typeof current() === 'boolean'}>
          <input
            type="checkbox"
            aria-label={label(leaf)}
            checked={Boolean(current())}
            onInput={(e) => change(e.currentTarget.checked)}
          />
        </Match>
        <Match when={typeof current() === 'number'}>
          <input
            type="number"
            step="any"
            aria-label={label(leaf)}
            value={Number(current())}
            onInput={(e) => change(e.currentTarget.valueAsNumber)}
          />
        </Match>
        <Match when={Array.isArray(current())}>
          <input
            aria-label={label(leaf)}
            value={(current() as string[]).join(', ')}
            onInput={(e) =>
              change(
                e.currentTarget.value
                  .split(',')
                  .map((v) => v.trim())
                  .filter(Boolean),
              )
            }
          />
        </Match>
      </Switch>
    )
  }
  return (
    <div class="settings">
      <nav aria-label={api.t('runtime.section')}>
        <For each={groups}>
          {(section) => (
            <button
              aria-current={group() === section ? 'page' : undefined}
              onClick={() => setGroup(section)}
            >
              {label(section)}
            </button>
          )}
        </For>
      </nav>
      <section class="fields">
        <h2>{label(group())}</h2>
        <Show when={saved()}>
          <For each={preferenceKeys.filter((key) => key.startsWith(group() + '.'))}>
            {(key) => {
              const path = fieldPath(key)
              const leaf = path.at(-1)!
              const title = key.startsWith('shortcuts.')
                ? leaf
                    .split('.')
                    .map((k) =>
                      k === 'main' || k === 'editor' || k === 'player' || k === 'reader'
                        ? k
                        : label(k),
                    )
                    .join(' · ')
                : [...path.slice(1, -1).map(label), label(leaf)].join(' · ')
              return (
                <div class="setting" id={'preference-' + key}>
                  <span>{title}</span>
                  {control(key)}
                </div>
              )
            }}
          </For>
        </Show>
        <Show when={group() === 'network' && network()}>
          {(state) => (
            <>
              <p>{api.t('runtime.proxyLifetime')}</p>
              <p role="status">
                {api.t(
                  (
                    {
                      ready: 'runtime.networkReady',
                      failed: 'runtime.networkFailed',
                      applying: 'runtime.networkApplying',
                    } as const
                  )[state().status],
                )}
              </p>
            </>
          )}
        </Show>
      </section>
      <footer>
        <Button variant="ghost" disabled={busy()} onClick={reset}>
          {api.t('runtime.reset')}
        </Button>
        <Button variant="outline" disabled={!edits().length || busy()} onClick={() => set([])}>
          {api.t('runtime.discard')}
        </Button>
        <Button
          disabled={!edits().length || busy()}
          onClick={() => void save().catch(props.report)}
        >
          {api.t('actions.save')}
        </Button>
      </footer>
    </div>
  )
}
