/** @fileoverview Edits complete light and dark theme drafts and manages the editor's application-wide preview. */

import { createEffect, createSignal, createResource, For, Show, onCleanup } from 'solid-js'
import { FontSelector, listFontOptions } from '../domain-ui/fonts/selection'
import { Button } from '@kisaki3/desktop-ui/button'
import type {
  Theme,
  ThemeRef,
  UserThemeCreate,
  UserThemeUpdate,
  ColorScheme,
  UserAppearanceTokens,
} from '@kisaki3/desktop-contracts/appearance'
import type { MainClient } from '../../../infrastructure/api'

/** Native theme library and editor. Saving the definition and selecting it have separate outcomes. */
export function Themes(props: {
  target?: ThemeRef | undefined
  api: MainClient
  onSave: (save: () => Promise<void>) => void
  dirty: (value: boolean) => void
  report: (error: unknown) => void
}) {
  const { api } = props
  /** Reads stable theme identities for the manager list. */
  const [catalog, { refetch }] = createResource(() => api.call('themes.list'))
  /** Reads user-owned font identities for the branch editors. */
  const [fonts] = createResource(() => listFontOptions(api))
  /** Keeps the original saved theme used for field-level comparisons. */
  const [original, setOriginal] = createSignal<Theme<'user'> | null>(null)
  /** Holds both editable branches and their unsaved name. */
  const [draft, setDraft] = createSignal<UserThemeCreate>()
  /** Loads system family names when a theme editor needs them. */
  const [systemFonts] = createResource(
    () => !!draft(),
    () =>
      api.call('fonts.system').catch((cause) => {
        props.report(cause)
        return []
      }),
  )
  /** Selects the currently edited branch independently from the application mode. */
  const [scheme, setScheme] = createSignal<ColorScheme>('light')
  /** Holds only this editor's application preview identity. */
  const [preview, setPreview] = createSignal<string>()
  let previewRequest = 0
  /** Keeps save actions disabled while a theme operation is pending. */
  const [busy, setBusy] = createSignal(false)
  /** Tracks whether the current editor needs a close decision. */
  const [modified, setModified] = createSignal(false)
  /** Updates the editor and the owning dialog's dirty state together. */
  const notify = (dirty: boolean) => {
    setModified(dirty)
    props.dirty(dirty)
  }
  /** Revokes only this editor's preview, including a pending start. */
  const end = () => {
    previewRequest++
    const id = preview()
    setPreview(undefined)
    if (id) {
      void api.call('resources.release', id).catch(props.report)
    }
  }
  /** Clears the control only when this editor's preview ended. */
  const ended = (event: Event) => {
    if ((event as CustomEvent<string>).detail === preview()) {
      setPreview(undefined)
    }
  }
  /** Rereads the theme catalog after committed changes. */
  const refresh = () => void refetch()
  api.topics.addEventListener('themes.changed', refresh)
  api.topics.addEventListener('preview.ended', ended)
  onCleanup(() => {
    end()
    api.topics.removeEventListener('themes.changed', refresh)
    api.topics.removeEventListener('preview.ended', ended)
  })
  /** Starts or updates a preview for the current complete branch draft. */
  const applyPreview = async (value: UserThemeCreate, branch: ColorScheme) => {
    const current = preview()
    const input = { colorScheme: branch, tokens: value[branch] }
    if (current) {
      await api.call('themes.updatePreview', current, input)
      return
    }
    const request = ++previewRequest
    const id = await api.call('themes.preview', input)
    if (request === previewRequest) {
      setPreview(id)
    } else {
      await api.call('resources.release', id)
    }
  }
  /** Updates the unsaved branch and refreshes its owned preview. */
  const modify = (value: UserThemeCreate) => {
    setDraft(value)
    notify(true)
    if (preview()) {
      void applyPreview(value, scheme()).catch(props.report)
    }
  }
  /** Creates an edit draft from the selected theme or its independent copy. */
  const open = async (ref: ThemeRef, mode: 'new' | 'copy' | 'edit', name?: string) => {
    if (modified() && !confirm(api.t('runtime.discardQuestion'))) {
      return
    }
    const target = mode === 'copy' ? await api.call('themes.clone', ref, name!) : ref
    const theme = await api.call('themes.get', target)
    if (!theme) {
      throw new Error(api.t('runtime.unavailable'))
    }
    end()
    const user = theme as Theme<'user'> | Theme<'builtin'>
    setOriginal(target.type === 'user' ? (user as Theme<'user'>) : null)
    setDraft({
      name: mode !== 'new' && typeof user.name === 'string' ? user.name : api.t('runtime.newTheme'),
      light: user.light,
      dark: user.dark,
    })
    notify(mode === 'new')
  }
  /** Saves the definition and optionally selects it against the captured original selection. */
  const save = async (use: boolean) => {
    const value = draft()!
    const old = original()
    setBusy(true)
    try {
      const selected = use ? (await api.call('preferences.get')).appearance.theme : undefined
      let ref: ThemeRef
      if (old) {
        const changes: Record<string, unknown> = {},
          expected: Record<string, unknown> = {}
        if (old.name !== value.name) {
          changes.name = value.name
          expected.name = old.name
        }
        for (const branch of ['light', 'dark'] as const) {
          const keys = (Object.keys(value[branch]) as (keyof UserAppearanceTokens)[]).filter(
            (key) => JSON.stringify(value[branch][key]) !== JSON.stringify(old[branch][key]),
          )
          if (keys.length) {
            changes[branch] = Object.fromEntries(keys.map((k) => [k, value[branch][k]]))
            expected[branch] = Object.fromEntries(keys.map((k) => [k, old[branch][k]]))
          }
        }
        await api.call('themes.update', old.ref.id, { changes, expected } as UserThemeUpdate)
        ref = old.ref
      } else {
        ref = await api.call('themes.create', value)
      }
      setOriginal({ ...value, ref: ref as Theme<'user'>['ref'] })
      notify(false)
      if (use) {
        try {
          await api.call('preferences.update', {
            changes: { appearance: { theme: ref } },
            ...(selected?.status === 'ready' && {
              expected: { appearance: { theme: selected.value } },
            }),
          })
        } catch (cause) {
          throw new Error(api.t('runtime.savedConflict'), { cause })
        }
      }
      end()
      setDraft(undefined)
    } finally {
      setBusy(false)
    }
  }
  props.onSave(() => save(false))
  /** Last requested directory target scrolled into view for this dialog. */
  let focused: ThemeRef | undefined
  createEffect(() => {
    const ref = props.target
    if (!ref || ref === focused || !catalog()) {
      return
    }
    focused = ref
    queueMicrotask(() => {
      const row = document.getElementById('theme-' + JSON.stringify(ref))
      if (row) {
        row.scrollIntoView({ block: 'nearest' })
        row.focus()
      } else {
        props.report(new Error(api.t('runtime.unavailable')))
      }
    })
  })
  /** Confirms deletion of a user-owned theme. */
  const remove = async (ref: ThemeRef) => {
    if (ref.type === 'user' && confirm(api.t('runtime.removeConfirm'))) {
      await api.call('themes.delete', ref.id)
    }
  }
  return (
    <section class="management">
      <Show
        when={draft()}
        fallback={
          <>
            <div class="page-heading">
              <h2>{api.t('runtime.themes')}</h2>
              <Button
                onClick={() =>
                  void open({ type: 'builtin', id: 'default' }, 'new').catch(props.report)
                }
              >
                {api.t('runtime.newTheme')}
              </Button>
            </div>
            <For each={catalog()}>
              {(item) => (
                <div class="setting" id={'theme-' + JSON.stringify(item.ref)} tabIndex={-1}>
                  <strong>{item.name}</strong>
                  <div class="tool-row">
                    <Button
                      variant="outline"
                      onClick={() =>
                        void open(item.ref, 'copy', item.name + ' (copy)').catch(props.report)
                      }
                    >
                      {api.t('runtime.clone')}
                    </Button>
                    <Show when={item.ref.type === 'user'}>
                      <Button
                        variant="outline"
                        onClick={() => void open(item.ref, 'edit').catch(props.report)}
                      >
                        {api.t('actions.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void remove(item.ref).catch(props.report)}
                      >
                        {api.t('actions.delete')}
                      </Button>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </>
        }
      >
        {(value) => (
          <>
            <div class="tool-row">
              <label>
                {api.t('runtime.name')}{' '}
                <input
                  value={value().name}
                  onInput={(e) => modify({ ...value(), name: e.currentTarget.value })}
                />
              </label>
              <select
                aria-label={api.t('runtime.section')}
                value={scheme()}
                onChange={(e) => {
                  const branch = e.currentTarget.value as ColorScheme
                  setScheme(branch)
                  if (preview()) {
                    void applyPreview(value(), branch).catch(props.report)
                  }
                }}
              >
                <option value="light">{api.t('runtime.light')}</option>
                <option value="dark">{api.t('runtime.dark')}</option>
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={!!preview()}
                  onInput={(e) => {
                    if (e.currentTarget.checked) {
                      void applyPreview(value(), scheme()).catch(props.report)
                    } else {
                      end()
                    }
                  }}
                />
                {api.t('runtime.preview')}
              </label>
            </div>
            <For each={Object.keys(value()[scheme()]) as (keyof UserAppearanceTokens)[]}>
              {(key) => {
                /** Reads the current branch's value for the displayed token. */
                const token = () => value()[scheme()][key]
                /** Replaces only the edited token in its current branch. */
                const change = (v: unknown) =>
                  modify({ ...value(), [scheme()]: { ...value()[scheme()], [key]: v } })
                return (
                  <label class="setting">
                    <span>{key.slice(2).replaceAll('-', ' ')}</span>
                    <Show
                      when={typeof token() === 'string'}
                      fallback={
                        <FontSelector
                          api={api}
                          label={key}
                          fallback="default"
                          value={token()}
                          change={change}
                          users={fonts() ?? []}
                          system={systemFonts() ?? []}
                        />
                      }
                    >
                      <input
                        aria-label={key}
                        value={typeof token() === 'string' ? (token() as string) : ''}
                        onInput={(e) => change(e.currentTarget.value)}
                      />
                    </Show>
                  </label>
                )
              }}
            </For>
            <footer>
              <Button
                variant="ghost"
                onClick={() => {
                  if (!modified() || confirm(api.t('runtime.discardQuestion'))) {
                    end()
                    notify(false)
                    setDraft(undefined)
                  }
                }}
              >
                {api.t('actions.cancel')}
              </Button>
              <Button disabled={busy()} onClick={() => void save(false).catch(props.report)}>
                {api.t('actions.save')}
              </Button>
              <Button disabled={busy()} onClick={() => void save(true).catch(props.report)}>
                {api.t('runtime.saveUse')}
              </Button>
            </footer>
          </>
        )}
      </Show>
    </section>
  )
}
