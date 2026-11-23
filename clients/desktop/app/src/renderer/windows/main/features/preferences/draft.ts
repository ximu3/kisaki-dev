import { createMemo, createSignal, onCleanup, type Accessor } from 'solid-js'
import { interfaceScaleRange } from '@kisaki3/desktop-contracts/appearance'
import { manualProxyIssue, type ProxyCredentials } from '@kisaki3/desktop-contracts/network'
import {
  effectiveShortcutBindings,
  findShortcutConflicts,
  parsePreferencesUpdate,
  type PreferenceKey,
  type Preferences,
  type PreferencesSnapshot,
  type ShortcutKey,
} from '@kisaki3/desktop-contracts/preferences'
import type { FieldIssue } from '@kisaki3/desktop-ui/form'
import type { MainClient } from '../../../../infrastructure/api'
import { createQuery } from '../../../../infrastructure/query'

interface FieldEdit {
  readonly input: unknown
  readonly expected: unknown
}

type FieldEdits = ReadonlyMap<PreferenceKey, FieldEdit>

type AtPath<T, K extends string> = K extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? AtPath<T[Head], Rest>
    : never
  : K extends keyof T
    ? T[K]
    : never

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

function fieldPath(key: PreferenceKey) {
  const shortcutPrefix = 'shortcuts.'
  return key.startsWith(shortcutPrefix)
    ? ['shortcuts', key.slice(shortcutPrefix.length)]
    : key.split('.')
}

function availableValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'status' in value) {
    return 'value' in value ? value.value : undefined
  }
  return value
}

function readField(source: PreferencesSnapshot | Preferences | undefined, key: PreferenceKey) {
  let current: unknown = source
  for (const part of fieldPath(key)) {
    current = availableValue(current)
    current =
      current && typeof current === 'object'
        ? (current as Record<string, unknown>)[part]
        : undefined
  }
  return availableValue(current)
}

function fieldName(key: PreferenceKey) {
  return fieldPath(key).at(-1)!
}

function displayValue(key: PreferenceKey, value: unknown) {
  if (
    (key === 'usage.anime.audioLanguages' || key === 'usage.anime.subtitleLanguages') &&
    Array.isArray(value)
  ) {
    return value.join(', ')
  }
  return typeof value === 'number' || fieldName(key) === 'paragraphSpacing' ? String(value) : value
}

function parseInput(key: PreferenceKey, input: unknown) {
  if (typeof input !== 'string') {
    return input
  }
  if (key === 'usage.anime.audioLanguages' || key === 'usage.anime.subtitleLanguages') {
    return input
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }

  const name = fieldName(key)
  if (numericFields.has(name) || (name === 'paragraphSpacing' && input !== 'document')) {
    return input.trim() ? Number(input) : NaN
  }
  return input
}

function putField(tree: Record<string, unknown>, path: readonly string[], value: unknown) {
  if (value === undefined) {
    return
  }
  let group = tree
  for (const part of path.slice(0, -1)) {
    group = (group[part] ??= {}) as Record<string, unknown>
  }
  group[path.at(-1)!] = value
}

function updateInput(edits: Iterable<readonly [PreferenceKey, FieldEdit]>) {
  const changes: Record<string, unknown> = {}
  const expected: Record<string, unknown> = {}
  for (const [key, edit] of edits) {
    const path = fieldPath(key)
    putField(changes, path, parseInput(key, edit.input))
    putField(expected, path, edit.expected)
  }
  return parsePreferencesUpdate({ changes, expected })
}

function equalValue(first: unknown, second: unknown) {
  return JSON.stringify(first) === JSON.stringify(second)
}

function isChanged(key: PreferenceKey, edit: FieldEdit) {
  return !equalValue(displayValue(key, edit.expected), edit.input)
}

function recordEdit(
  edits: Map<PreferenceKey, FieldEdit>,
  key: PreferenceKey,
  incoming: FieldEdit,
  saving?: FieldEdits,
) {
  const previous = edits.get(key)
  const edit = previous ? { ...incoming, expected: previous.expected } : incoming
  if (saving?.has(key) || isChanged(key, edit)) {
    edits.set(key, edit)
  } else {
    edits.delete(key)
  }
}

function validateFields(api: MainClient, edits: FieldEdits): FieldIssue[] {
  const issues: FieldIssue[] = []
  for (const [key, edit] of edits) {
    try {
      updateInput([[key, edit]])
    } catch {
      issues.push({
        id: key,
        summary:
          key === 'appearance.interfaceScale'
            ? api.t('runtime.scaleRange', interfaceScaleRange)
            : api.t('runtime.invalidValue'),
      })
    }
  }
  return issues
}

function createPreferenceFields(
  readInput: (key: PreferenceKey) => unknown,
  writeInput: (key: PreferenceKey, input: unknown) => void,
  defaults: Accessor<Preferences | undefined>,
) {
  function read<K extends PreferenceKey>(key: K) {
    return readInput(key) as DraftValue<K> | undefined
  }

  function write<K extends PreferenceKey>(key: K, input: DraftValue<K>) {
    writeInput(key, input)
  }

  function canReset(key: PreferenceKey) {
    const values = defaults()
    return !!values && !equalValue(readInput(key), displayValue(key, readField(values, key)))
  }

  function reset(key: PreferenceKey) {
    writeInput(key, displayValue(key, readField(defaults(), key)))
  }

  return { read, write, canReset, reset }
}

export type PreferenceFields = ReturnType<typeof createPreferenceFields>

export function createPreferenceDraft(api: MainClient) {
  const snapshot = createQuery((signal) => api.request(signal, 'preferences.get'))
  const defaultsQuery = createQuery((signal) => api.request(signal, 'preferences.defaults'))
  const saved = createMemo<PreferencesSnapshot | undefined>((previous) =>
    snapshot.error ? previous : snapshot.value,
  )
  const defaults = () => (defaultsQuery.error ? undefined : defaultsQuery.value)

  const [edits, setEdits] = createSignal<FieldEdits>(new Map())
  const lastCommits = new Map<PreferenceKey, { value: unknown }>()
  let saving: FieldEdits | undefined
  let active = true

  const reload = () => void snapshot.reload()
  api.topics.addEventListener('window.changed', reload)
  onCleanup(() => {
    active = false
    api.topics.removeEventListener('window.changed', reload)
  })

  function readInput(key: PreferenceKey) {
    const edit = edits().get(key)
    return edit ? edit.input : displayValue(key, readField(saved(), key))
  }

  function writeInput(key: PreferenceKey, input: unknown) {
    const expected = readField(saved(), key)
    setEdits((previous) => {
      const next = new Map(previous)
      recordEdit(next, key, { input, expected }, saving)
      return next
    })
  }
  const fields = createPreferenceFields(readInput, writeInput, defaults)

  function validate(): FieldIssue[] {
    const pending = edits()
    const issues = validateFields(api, pending)
    const base = saved()
    if (issues.length || !base || !pending.size) {
      return issues
    }

    const { changes } = updateInput(pending)
    if (changes.shortcuts) {
      const conflicts = findShortcutConflicts(
        effectiveShortcutBindings(base.shortcuts, changes.shortcuts),
        api.platform,
      )
      for (const key of new Set(conflicts.flatMap(({ first, second }) => [first, second]))) {
        issues.push({ id: `shortcuts.${key}`, summary: api.t('runtime.shortcutOverlap') })
      }
    }

    const route = base.network.status === 'ready' ? base.network.value : defaults()?.network
    if (changes.network && route) {
      const next = { ...route, ...changes.network }
      const key = manualProxyIssue(next.mode, next.endpoint, next.credentials !== null)
      if (key) {
        issues.push({
          id: `network.${key}`,
          summary: api.t(
            key === 'endpoint' ? 'runtime.proxyAddressNeeded' : 'runtime.socksCredentials',
          ),
        })
      }
    }
    return issues
  }

  function adoptSave(submitted: FieldEdits, result: PreferencesSnapshot) {
    const remaining = new Map(edits())
    for (const [key, committed] of submitted) {
      const expected = readField(result, key)
      lastCommits.set(key, { value: expected })

      // A new input can arrive while this exact edit is being saved.
      const current = remaining.get(key)
      remaining.delete(key)
      if (current && current !== committed) {
        recordEdit(remaining, key, { input: current.input, expected })
      }
    }
    snapshot.accept(result)
    setEdits(remaining)
  }

  async function save() {
    const submitted = edits()
    if (!submitted.size) {
      return
    }

    saving = submitted
    try {
      const result = await api.call('preferences.update', updateInput(submitted))
      if (active) {
        adoptSave(submitted, result)
      }
    } catch (cause) {
      if (active) {
        setEdits((current) => new Map([...current].filter(([key, edit]) => isChanged(key, edit))))
      }
      throw cause
    } finally {
      saving = undefined
    }
  }

  function stage(keys: readonly PreferenceKey[]) {
    const base = saved()
    const opening = new Map(
      keys.map((key) => [
        key,
        {
          input: readInput(key),
          expected: readField(base, key),
          lastCommit: lastCommits.get(key),
        },
      ]),
    )
    const [pending, setPending] = createSignal<FieldEdits>(new Map())

    function readStagedInput(key: PreferenceKey) {
      const edit = pending().get(key) ?? opening.get(key)!
      return edit.input
    }

    function writeStagedInput(key: PreferenceKey, input: unknown) {
      const { input: initial, expected } = opening.get(key)!
      setPending((edits) => {
        const next = new Map(edits)
        if (equalValue(initial, input)) {
          next.delete(key)
        } else {
          next.set(key, { input, expected })
        }
        return next
      })
    }

    function apply() {
      setEdits((edits) => {
        const next = new Map(edits)
        for (const [key, edit] of pending()) {
          // Only a save from this editor can replace the staged field's original baseline.
          const commit = lastCommits.get(key)
          const expected =
            commit && commit !== opening.get(key)!.lastCommit ? commit.value : edit.expected
          recordEdit(next, key, { input: edit.input, expected }, saving)
        }
        return next
      })
    }

    return {
      ...createPreferenceFields(readStagedInput, writeStagedInput, defaults),
      dirty: () => pending().size > 0,
      validate: () => validateFields(api, pending()),
      apply,
    }
  }

  function retry() {
    if (snapshot.error) {
      void snapshot.reload()
    }
    if (defaultsQuery.error) {
      void defaultsQuery.reload()
    }
  }

  return {
    ...fields,
    ready: saved,
    error: (): unknown => snapshot.error ?? defaultsQuery.error,
    retry,
    validate,
    save,
    stage,
    dirty: () => edits().size > 0,
  }
}

export type PreferenceDraft = ReturnType<typeof createPreferenceDraft>
export type PreferenceStage = ReturnType<PreferenceDraft['stage']>
