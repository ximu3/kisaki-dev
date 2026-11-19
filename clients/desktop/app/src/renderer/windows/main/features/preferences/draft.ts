/** @fileoverview Preserves local preference edits at the public field and baseline boundaries. */

import {
  parsePreferencesUpdate,
  type PreferenceKey,
  type PreferencesSnapshot,
  type Preferences,
  type ShortcutKey,
  effectiveShortcutBindings,
  findShortcutConflicts,
} from '@kisaki3/desktop-contracts/preferences'
import { createMemo, createResource, createSignal, batch, onCleanup, type Accessor } from 'solid-js'
import type { FieldIssue } from '@kisaki3/desktop-ui/form'
import { manualProxyIssue, type ProxyCredentials } from '@kisaki3/desktop-contracts/network'
import { interfaceScaleRange } from '@kisaki3/desktop-contracts/appearance'
import type { MainClient } from '../../../../infrastructure/api'

/** Paths for the editor preserve dotted shortcut identities as a single object key. */
function fieldPath(key: PreferenceKey) {
  return key.startsWith('shortcuts.') ? ['shortcuts', key.slice(10)] : key.split('.')
}

/** Reads through valid stored definitions while preserving unavailable choices as undefined. */
function fieldValue(value: unknown, path: readonly string[]): unknown {
  let current = value
  for (const key of [...path, undefined]) {
    if (current && typeof current === 'object' && 'status' in current) {
      current = 'value' in current ? current.value : undefined
    }
    if (key !== undefined) {
      current =
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[key]
          : undefined
    }
  }
  return current
}

/** One edited unit and the exact original value from the time editing began. */
interface FieldEdit {
  path: string[]
  value: unknown
  original: unknown
}

/** Formats the stored value for fields that accept unfinished textual input. */
function draftValue(path: readonly string[], stored: unknown): unknown {
  const key = path.at(-1)
  if ((key === 'audioLanguages' || key === 'subtitleLanguages') && Array.isArray(stored)) {
    return stored.join(', ')
  }
  if (key === 'paragraphSpacing') {
    return String(stored)
  }
  return typeof stored === 'number' ? String(stored) : stored
}

/** Converts text to the domain value only when validating or committing an edit. */
function submittedValue(edit: FieldEdit) {
  const key = edit.path.at(-1)
  if (typeof edit.value === 'string') {
    if (key === 'audioLanguages' || key === 'subtitleLanguages') {
      return edit.value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
    }
    if (numericFields.has(key!) || (key === 'paragraphSpacing' && edit.value !== 'document')) {
      return edit.value.trim() ? Number(edit.value) : NaN
    }
  }
  return edit.value
}

/** Maps independent fields back to the typed changes and matching expected-value tree. */
function updateInput(edits: readonly FieldEdit[]) {
  const changes: Record<string, unknown> = {}
  const expected: Record<string, unknown> = {}
  for (const edit of edits) {
    for (const [root, value] of [
      [changes, submittedValue(edit)],
      [expected, edit.original],
    ] as const) {
      if (value === undefined) {
        continue
      }
      let parent = root
      for (const key of edit.path.slice(0, -1)) {
        parent = (parent[key] ??= {}) as Record<string, unknown>
      }
      parent[edit.path.at(-1)!] = value
    }
  }
  return parsePreferencesUpdate({ changes, expected })
}

/** Compares preference values in their stable schema representation. */
function sameValue(first: unknown, second: unknown) {
  return JSON.stringify(first) === JSON.stringify(second)
}

/** Finds the independently edited field at the supplied path. */
function findEdit(edits: readonly FieldEdit[], path: readonly string[]) {
  return edits.find((edit) => edit.path.join('.') === path.join('.'))
}

/** Keeps an existing dirty field's baseline across unrelated saved-state invalidations. */
function editField(edits: readonly FieldEdit[], incoming: FieldEdit, retain = false): FieldEdit[] {
  const { path, value } = incoming
  const previous = findEdit(edits, path)
  const original = previous ? previous.original : incoming.original
  const remaining = edits.filter((edit) => edit !== previous)
  return !retain && sameValue(draftValue(path, original), value)
    ? remaining
    : [...remaining, { path, value, original }]
}

/** Reports input errors before accepting staged fields or attempting persistence. */
function validateFields(api: MainClient, edits: readonly FieldEdit[]): FieldIssue[] {
  const issues: FieldIssue[] = []
  for (const edit of edits) {
    try {
      updateInput([edit])
    } catch {
      const id = edit.path.join('.')
      issues.push({
        id,
        summary:
          id === 'appearance.interfaceScale'
            ? api.t('runtime.scaleRange', interfaceScaleRange)
            : api.t('runtime.invalidValue'),
      })
    }
  }
  return issues
}

/** Numeric preference fields retain raw text until the draft is validated and submitted. */
const numericFields = new Set([
  'interfaceScale',
  'visibleLimit',
  'foregroundGracePeriodMs',
  'playbackSpeed',
  'subtitleScale',
  'brightness',
  'contrast',
  'pagesPerView',
  'fontSize',
  'lineHeight',
  'padding',
  'maxLineLength',
])

/** Resolves a dotted field path through the complete preference definition. */
type AtPath<T, K extends string> = K extends `${infer H}.${infer R}`
  ? H extends keyof T
    ? AtPath<T[H], R>
    : never
  : K extends keyof T
    ? T[K]
    : never

/** Gives dotted shortcut identities their list type and editable text fields their draft type. */
type DraftValue<K extends PreferenceKey> = K extends `shortcuts.${infer Key extends ShortcutKey}`
  ? Preferences['shortcuts'][Key]
  : K extends 'network.credentials'
    ? Preferences['network']['credentials'] | ProxyCredentials
    : K extends
          | `${string}.paragraphSpacing`
          | 'usage.anime.audioLanguages'
          | 'usage.anime.subtitleLanguages'
      ? string
      : AtPath<Preferences, K> extends number
        ? string
        : AtPath<Preferences, K>

/** Provides the same field editing and restore rules for a saved draft and a staged branch. */
function createPreferenceFields(
  value: (key: PreferenceKey) => unknown,
  change: (key: PreferenceKey, next: unknown) => void,
  defaults: Accessor<Preferences | undefined>,
) {
  function read<K extends PreferenceKey>(key: K) {
    return value(key) as DraftValue<K> | undefined
  }
  function write<K extends PreferenceKey>(key: K, next: DraftValue<K>) {
    change(key, next)
  }

  function canReset(key: PreferenceKey) {
    const base = defaults()
    const path = fieldPath(key)
    return !!base && !sameValue(value(key), draftValue(path, fieldValue(base, path)))
  }
  function reset(key: PreferenceKey) {
    const path = fieldPath(key)
    change(key, draftValue(path, fieldValue(defaults(), path)))
  }

  return { read, write, canReset, reset }
}

/** Typed editing operations shared by parent and child preference forms. */
export type PreferenceFields = ReturnType<typeof createPreferenceFields>

/** Owns this editor's captured field baselines, dirty values and persistence. */
export function createPreferenceDraft(api: MainClient) {
  const [snapshot, { refetch, mutate }] = createResource(() => api.call('preferences.get'))
  const [defaults, defaultActions] = createResource(() => api.call('preferences.defaults'))
  const saved = createMemo<PreferencesSnapshot | undefined>((previous) =>
    snapshot.error ? previous : snapshot(),
  )

  const [edits, setEdits] = createSignal<FieldEdit[]>([])
  const written = new Map<string, { value: unknown }>()
  let submitted: readonly FieldEdit[] = []
  let active = true
  const reload = () => void refetch()
  api.topics.addEventListener('window.changed', reload)
  onCleanup(() => {
    active = false
    api.topics.removeEventListener('window.changed', reload)
  })

  const availableDefaults = () => (defaults.error ? undefined : defaults())

  function value(key: PreferenceKey) {
    const path = fieldPath(key)
    const edit = findEdit(edits(), path)
    return edit ? edit.value : draftValue(path, fieldValue(saved(), path))
  }
  function change(key: PreferenceKey, next: unknown) {
    const path = fieldPath(key)
    const edit = { path, value: next, original: fieldValue(saved(), path) }
    setEdits((items) => editField(items, edit, !!findEdit(submitted, path)))
  }
  const fields = createPreferenceFields(value, change, availableDefaults)

  function validate(): FieldIssue[] {
    const issues = validateFields(api, edits())
    const base = saved()
    if (issues.length || !base || !edits().length) {
      return issues
    }

    const changes = updateInput(edits()).changes
    if (changes.shortcuts) {
      const conflicts = findShortcutConflicts(
        effectiveShortcutBindings(base.shortcuts, changes.shortcuts),
        api.platform,
      )
      for (const key of new Set(conflicts.flatMap(({ first, second }) => [first, second]))) {
        issues.push({ id: 'shortcuts.' + key, summary: api.t('runtime.shortcutOverlap') })
      }
    }
    const fallback = defaults.error ? undefined : defaults()?.network
    const route = base.network.status === 'ready' ? base.network.value : fallback
    if (changes.network && route) {
      const next = { ...route, ...changes.network }
      const key = manualProxyIssue(next.mode, next.endpoint, next.credentials !== null)
      if (key) {
        issues.push({
          id: 'network.' + key,
          summary: api.t(
            key === 'endpoint' ? 'runtime.proxyAddressNeeded' : 'runtime.socksCredentials',
          ),
        })
      }
    }
    return issues
  }

  async function save() {
    if (!edits().length) {
      return
    }
    submitted = edits()
    try {
      const result = await api.call('preferences.update', updateInput(submitted))
      if (!active) {
        return
      }

      for (const edit of submitted) {
        const value = fieldValue(result, edit.path)
        written.set(edit.path.join('.'), { value })
      }
      const remaining = edits()
        .filter((edit) => !submitted.includes(edit))
        .flatMap((edit) =>
          findEdit(submitted, edit.path)
            ? editField([], { ...edit, original: fieldValue(result, edit.path) })
            : [edit],
        )
      batch(() => {
        mutate(result)
        setEdits(remaining)
      })
    } catch (cause) {
      if (active) {
        setEdits((items) =>
          items.filter((edit) => !sameValue(draftValue(edit.path, edit.original), edit.value)),
        )
      }
      throw cause
    } finally {
      submitted = []
    }
  }

  function stage(keys: readonly PreferenceKey[]) {
    const opening = new Map(
      keys.map((key) => {
        const path = fieldPath(key)
        return [
          key,
          {
            path,
            value: value(key),
            original: fieldValue(saved(), path),
            written: written.get(key),
          },
        ]
      }),
    )
    const [pending, setPending] = createSignal(new Map<PreferenceKey, FieldEdit>())

    function readChild(key: PreferenceKey) {
      const edit = pending().get(key)
      return edit ? edit.value : opening.get(key)!.value
    }
    function writeChild(key: PreferenceKey, next: unknown) {
      const { path, value, original } = opening.get(key)!
      setPending((edits) => {
        const updated = new Map(edits)
        if (sameValue(value, next)) {
          updated.delete(key)
        } else {
          updated.set(key, { path, value: next, original })
        }
        return updated
      })
    }

    function apply() {
      setEdits((edits) => {
        let updated = edits
        for (const [key, edit] of pending()) {
          // A parent save already in progress when this child opened may have established a new baseline.
          const committed = written.get(key)
          const next =
            committed && committed !== opening.get(key)!.written
              ? { ...edit, original: committed.value }
              : edit
          updated = editField(updated, next, !!findEdit(submitted, edit.path))
        }
        return updated
      })
    }

    return {
      ...createPreferenceFields(readChild, writeChild, availableDefaults),
      dirty: () => pending().size > 0,
      validate: () => validateFields(api, Array.from(pending().values())),
      apply,
    }
  }

  return {
    ...fields,
    ready: saved,
    error: (): unknown => snapshot.error ?? defaults.error,
    retry: () => {
      if (snapshot.error) {
        void refetch()
      }
      if (defaults.error) {
        void defaultActions.refetch()
      }
    },
    validate,
    save,
    stage,
    dirty: () => edits().length > 0,
  }
}

/** Draft API shared only by the field groups of one preference editor. */
export type PreferenceDraft = ReturnType<typeof createPreferenceDraft>

/** One temporary set of field edits that can be applied to the parent draft. */
export type PreferenceStage = ReturnType<PreferenceDraft['stage']>
