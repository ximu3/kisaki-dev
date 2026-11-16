/** @fileoverview Preserves local preference edits at the public field and baseline boundaries. */

import {
  parsePreferencesUpdate,
  type PreferenceKey,
  type PreferencesSnapshot,
} from '@kisaki3/desktop-contracts/preferences'

/** Paths for the editor preserve dotted shortcut identities as a single object key. */
export function fieldPath(key: PreferenceKey) {
  return key.startsWith('shortcuts.') ? ['shortcuts', key.slice(10)] : key.split('.')
}

/** Reads through valid stored definitions while preserving unavailable choices as undefined. */
export function fieldValue(value: unknown, path: readonly string[]): unknown {
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
export interface FieldEdit {
  path: string[]
  value: unknown
  original: unknown
}

/** Maps independent fields back to the typed changes and matching expected-value tree. */
export function updateInput(edits: readonly FieldEdit[]) {
  const changes: Record<string, unknown> = {}
  const expected: Record<string, unknown> = {}
  for (const edit of edits) {
    for (const [root, value] of [
      [changes, edit.value],
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

/** Keeps the baseline of an existing dirty field across unrelated saved-state invalidations. */
export function editField(
  edits: readonly FieldEdit[],
  saved: PreferencesSnapshot,
  path: string[],
  value: unknown,
): FieldEdit[] {
  const key = JSON.stringify(path)
  const previous = edits.find((edit) => JSON.stringify(edit.path) === key)
  const original = previous ? previous.original : fieldValue(saved, path)
  const remaining = edits.filter((edit) => edit !== previous)
  return JSON.stringify(original) === JSON.stringify(value)
    ? remaining
    : [...remaining, { path, value, original }]
}
