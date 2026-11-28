import { createPreferencesQuery } from '../../domain-ui/preferences/query'
import { getOwner, isDisposed, createMemo, createSignal } from 'solid-js'
import { dequal as equalValue } from 'dequal/lite'
import { interfaceScaleRange } from '@kisaki3/desktop-contracts/appearance'
import { manualProxyIssue } from '@kisaki3/desktop-contracts/network'
import {
  effectiveShortcutBindings,
  findShortcutConflicts,
  parsePreferencesUpdate,
  type PreferenceKey,
  type PreferencesSnapshot,
} from '@kisaki3/desktop-contracts/preferences'
import type { FieldIssue } from '@kisaki3/desktop-ui/form'
import type { MainClient } from '../../../../infrastructure/api'
import { createViewQuery } from '../../../../infrastructure/query'

import {
  createPreferenceFields,
  displayValue,
  fieldPath,
  readField,
  type FieldInput,
} from '../../domain-ui/preferences/values'

interface FieldEdit extends FieldInput {
  readonly expected: unknown
}

type FieldEdits = ReadonlyMap<PreferenceKey, FieldEdit>

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
    putField(changes, path, edit.value)
    putField(expected, path, edit.expected)
  }
  return parsePreferencesUpdate({ changes, expected })
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
            ? api.t('preferences.appearance.scaleRange', interfaceScaleRange)
            : api.t('forms.invalidValue'),
      })
    }
  }
  return issues
}

export function createPreferenceDraft(api: MainClient) {
  const preferences = createPreferencesQuery(api)
  const defaultsQuery = createViewQuery((signal) => api.request(signal, 'preferences.defaults'))
  const saved = createMemo<PreferencesSnapshot | undefined>(
    (previous) => preferences.result()?.value ?? previous,
  )
  const defaults = () => defaultsQuery.result()?.value

  const [edits, setEdits] = createSignal<FieldEdits>(new Map())
  const lastCommits = new Map<PreferenceKey, { value: unknown }>()
  let saving: FieldEdits | undefined
  const owner = getOwner()!

  function readInput(key: PreferenceKey) {
    const edit = edits().get(key)
    return edit ? edit.input : displayValue(key, readField(saved(), key))
  }

  function writeInput(key: PreferenceKey, input: FieldInput) {
    const expected = readField(saved(), key)
    setEdits((previous) => {
      const next = new Map(previous)
      recordEdit(next, key, { ...input, expected }, saving)
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
        issues.push({ id: `shortcuts.${key}`, summary: api.t('shortcuts.conflict') })
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
            key === 'endpoint'
              ? 'preferences.network.missingEndpoint'
              : 'preferences.network.socksCredentials',
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
        recordEdit(remaining, key, { ...current, expected })
      }
    }
    preferences.accept(result)
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
      if (!isDisposed(owner)) {
        adoptSave(submitted, result)
      }
    } catch (cause) {
      if (!isDisposed(owner)) {
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

    function writeStagedInput(key: PreferenceKey, edit: FieldInput) {
      const { input, expected } = opening.get(key)!
      setPending((edits) => {
        const next = new Map(edits)
        if (equalValue(input, edit.input)) {
          next.delete(key)
        } else {
          next.set(key, { ...edit, expected })
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
          recordEdit(next, key, { ...edit, expected }, saving)
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
    if (preferences.result()?.error) {
      preferences.reload()
    }
    if (defaultsQuery.result()?.error) {
      void defaultsQuery.reload()
    }
  }

  return {
    ...fields,
    ready: saved,
    error: (): unknown => preferences.result()?.error ?? defaultsQuery.result()?.error,
    retry,
    validate,
    save,
    stage,
    dirty: () => edits().size > 0,
  }
}

type PreferenceDraft = ReturnType<typeof createPreferenceDraft>
export type PreferenceStage = ReturnType<PreferenceDraft['stage']>
