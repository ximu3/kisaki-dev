/** @fileoverview Edits grouped preference drafts and commits only changed fields with their original baselines. */

import {
  batch,
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
import type { FieldIssue } from '@kisaki3/desktop-ui/field'
import { createUniqueId } from 'solid-js'
import { createEditorValidation } from '../../domain-ui/validation'
import { EditorFooter } from '../../domain-ui/editor-footer'
import { createSubmission } from '../../domain-ui/submission'
import { WindowSelect } from '../../domain-ui/select'
import { FontSelector, listFontOptions } from '../../domain-ui/fonts/selection'
import { Button } from '@kisaki3/desktop-ui/button'
import { manualProxyIssue } from '@kisaki3/desktop-contracts/network'
import {
  effectiveShortcutBindings,
  findShortcutConflicts,
} from '@kisaki3/desktop-contracts/preferences'
import { interfaceScaleRange } from '@kisaki3/desktop-contracts/appearance'
import { preferenceKeys, type PreferenceKey } from '@kisaki3/desktop-contracts/preferences'
import type { englishMessages } from '@kisaki3/desktop-localization'
import { fieldPath, fieldValue, draftValue, editField, updateInput, type FieldEdit } from './draft'
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
  api: MainClient
  onSave: (save: () => Promise<void>) => void
  dirty: (changed: boolean) => void
  manage: (page: 'themes' | 'fonts') => void
  report: (error: unknown) => void
}) {
  const { api } = props
  const formId = createUniqueId()
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
    return edit ? edit.value : draftValue(path, fieldValue(saved(), path))
  }
  /** Changes one field while retaining its first comparison baseline. */
  const edit = (path: string[], next: unknown) =>
    set(
      editField(
        edits(),
        saved()!,
        path,
        next,
        submitted.some((item) => JSON.stringify(item.path) === JSON.stringify(path)),
      ),
    )
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
  let mounted = true
  onCleanup(() => {
    mounted = false
  })

  let submitted: readonly FieldEdit[] = []
  /** Associates constraint failures from any edited group with the field that can correct them. */
  function inspect(): FieldIssue[] {
    const result: FieldIssue[] = []
    for (const item of edits()) {
      try {
        updateInput([item])
      } catch {
        const id =
          item.path[0] === 'shortcuts' ? item.path.slice(0, 2).join('.') : item.path.join('.')
        const input = document
          .getElementById('preference-' + id)
          ?.querySelector<HTMLInputElement>('input:invalid')
        const summary =
          id === 'appearance.interfaceScale'
            ? api.t('runtime.scaleRange', interfaceScaleRange)
            : input?.validationMessage ||
              api.t('runtime.invalidField', { field: label(item.path.at(-1)!) })
        if (!result.some((issue) => issue.id === id)) {
          result.push({ id, summary })
        }
      }
    }
    const base = saved()
    if (result.length || !base || !edits().length) {
      return result
    }

    const changes = updateInput(edits()).changes
    if (changes.shortcuts) {
      const conflicts = findShortcutConflicts(
        effectiveShortcutBindings(base.shortcuts, changes.shortcuts),
        api.platform,
      )
      for (const key of new Set(conflicts.flatMap(({ first, second }) => [first, second]))) {
        result.push({ id: 'shortcuts.' + key, summary: api.t('runtime.shortcutOverlap') })
      }
    }
    const route = base.network.status === 'ready' ? base.network.value : defaults()?.network
    if (changes.network && route) {
      const network = { ...route, ...changes.network }
      const issue = manualProxyIssue(network.mode, network.endpoint, network.credentials !== null)
      if (issue) {
        result.push({
          id: 'network.' + issue,
          summary: api.t(
            issue === 'endpoint' ? 'runtime.proxyAddressNeeded' : 'runtime.socksCredentials',
          ),
        })
      }
    }
    return result
  }

  /** Reveals the group before moving focus to the first control of the erroneous setting. */
  function locate(key: string) {
    setGroup(key.split('.')[0]!)
    queueMicrotask(() => {
      const row = document.getElementById('preference-' + key)
      row?.scrollIntoView({ block: 'nearest' })
      row?.querySelector<HTMLElement>('input,button')?.focus()
    })
  }

  const validation = createEditorValidation(api, inspect, locate)

  const { busy, save } = createSubmission(async () => {
    if (!validation.validate()) {
      return
    }
    if (!edits().length) {
      return
    }
    submitted = edits()
    try {
      const result = await api.call('preferences.update', updateInput(submitted))
      if (!mounted) {
        return
      }
      const remaining = edits()
        .filter((item) => !submitted.includes(item))
        .flatMap((item) => {
          const previous = submitted.find(
            (sent) => JSON.stringify(sent.path) === JSON.stringify(item.path),
          )
          return previous ? editField([], result, item.path, item.value) : [item]
        })
      batch(() => {
        mutate(result)
        set(remaining)
        validation.clear()
      })
    } catch (cause) {
      if (mounted) {
        set(
          edits().filter(
            (item) =>
              JSON.stringify(draftValue(item.path, item.original)) !== JSON.stringify(item.value),
          ),
        )
      }
      throw cause
    } finally {
      submitted = []
    }
  })
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
        changed = editField(changed, saved()!, field, draftValue(field, fieldValue(base, field)))
      }
    }
    set(changed)
  }
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
    locate(key)
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
    /** Connects this setting's controls to its own accessible correction text. */
    const errorId = () => validation.errorId(key)
    const list = key === 'network.mode' ? ['system', 'direct', 'manual'] : choices[leaf]
    /** Displays stable resource identities and preserves an unavailable selection. */
    const selectRef = (items: () => readonly { ref: unknown; name: string }[]) => {
      /** Encodes the currently selected identity for its option key. */
      const serial = () => JSON.stringify(current()) ?? 'unavailable'
      return (
        <WindowSelect
          errorId={errorId()}
          api={api}
          label={label(leaf)}
          value={serial()}
          options={[
            ...(!items().some((item) => JSON.stringify(item.ref) === serial())
              ? [{ value: serial(), label: api.t('runtime.unavailable'), disabled: true }]
              : []),
            ...items().map((item) => ({ value: JSON.stringify(item.ref), label: item.name })),
          ]}
          change={(key) => change(JSON.parse(key))}
        />
      )
    }
    if (key.startsWith('shortcuts.')) {
      return (
        <div class="tool-row">
          <input
            aria-invalid={errorId() ? true : undefined}
            aria-describedby={errorId()}
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
      return selectRef(() => translations() ?? [])
    }
    if (key === 'appearance.theme') {
      return (
        <div>
          {selectRef(() => themes() ?? [])}
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
            aria-invalid={errorId() ? true : undefined}
            aria-describedby={errorId()}
            aria-label={api.t('runtime.username')}
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            autocomplete="off"
          />
          <input
            aria-invalid={errorId() ? true : undefined}
            aria-describedby={errorId()}
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
          <WindowSelect
            errorId={errorId()}
            api={api}
            label={label(leaf)}
            value={color().type}
            options={['document', 'theme', 'custom'].map((value) => ({
              value,
              label: choice(value),
            }))}
            change={(type) =>
              change(
                type === 'custom'
                  ? { type, foreground: '#222222', background: '#ffffff' }
                  : { type },
              )
            }
          />
          <Show when={color().type === 'custom'}>
            <For each={['foreground', 'background'] as const}>
              {(k) => (
                <input
                  aria-invalid={errorId() ? true : undefined}
                  aria-describedby={errorId()}
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
            errorId={errorId()}
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
        <WindowSelect
          errorId={errorId()}
          api={api}
          label={label(leaf)}
          value={String(current())}
          options={list.map((value) => ({ value, label: choice(value) }))}
          change={change}
        />
      )
    }
    if (leaf === 'paragraphSpacing' || leaf === 'audioLanguages' || leaf === 'subtitleLanguages') {
      return (
        <input
          aria-invalid={errorId() ? true : undefined}
          aria-describedby={errorId()}
          aria-label={label(leaf)}
          value={String(current())}
          onInput={(e) => change(e.currentTarget.value)}
        />
      )
    }
    return (
      <Switch
        fallback={
          <input
            aria-invalid={errorId() ? true : undefined}
            aria-describedby={errorId()}
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
            aria-invalid={errorId() ? true : undefined}
            aria-describedby={errorId()}
            type="checkbox"
            aria-label={label(leaf)}
            checked={Boolean(current())}
            onInput={(e) => change(e.currentTarget.checked)}
          />
        </Match>
        <Match when={typeof current() === 'number'}>
          <input
            aria-invalid={errorId() ? true : undefined}
            aria-describedby={errorId()}
            type="number"
            required
            min={leaf === 'interfaceScale' ? interfaceScaleRange.min : undefined}
            max={leaf === 'interfaceScale' ? interfaceScaleRange.max : undefined}
            step={leaf === 'interfaceScale' ? 1 : 'any'}
            aria-label={label(leaf)}
            value={Number(current())}
            onInput={(e) => change(e.currentTarget.valueAsNumber)}
          />
        </Match>
      </Switch>
    )
  }
  return (
    <form
      id={formId}
      class="settings"
      onFocusIn={(event) => {
        const row = (event.target as HTMLElement).closest<HTMLElement>('.setting')
        if (!row && !(event.target as HTMLElement).closest('footer')) {
          validation.focus(null)
        }
      }}
      novalidate
      onSubmit={(event) => {
        event.preventDefault()
        void save().catch(props.report)
      }}
    >
      <nav aria-label={api.t('runtime.section')}>
        <For each={groups}>
          {(section) => (
            <button
              type="button"
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
                <div
                  class="setting"
                  onFocusIn={() => validation.focus(key)}
                  id={'preference-' + key}
                >
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
      <EditorFooter>
        <validation.Feedback />
        <Button variant="ghost" disabled={busy()} onClick={reset}>
          {api.t('runtime.reset')}
        </Button>
        <Button
          variant="outline"
          disabled={!edits().length || busy()}
          onClick={() => {
            set([])
            validation.clear()
          }}
        >
          {api.t('runtime.discard')}
        </Button>
        <Button type="submit" form={formId} disabled={!edits().length || busy()}>
          {api.t('actions.save')}
        </Button>
      </EditorFooter>
    </form>
  )
}
