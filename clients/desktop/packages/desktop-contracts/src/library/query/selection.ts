/** @fileoverview Validates fixed selections and explicit expanded group ranges. */

import type { EntryRef } from '../catalog'
import type { EntryGroupKey } from './listing'
import * as v from 'valibot'
import { groupSchema } from './listing'
import { entryRefSchema } from '../catalog'
import { parseValue, unique } from '../../validation'
import { DesktopError } from '../../errors'

/** A one-read fixed selection. Reversed endpoints select the same closed interval; all ignores collapsed groups. */
export type EntrySelection =
  | { readonly type: 'all' }
  | { readonly type: 'range'; readonly anchor: EntryRef; readonly focus: EntryRef }
  | {
      readonly type: 'groupRange'
      readonly anchor: { readonly group: EntryGroupKey; readonly ref: EntryRef }
      readonly focus: { readonly group: EntryGroupKey; readonly ref: EntryRef }
      readonly expandedGroups: readonly EntryGroupKey[]
    }

function groupKey(group: EntryGroupKey): string {
  return group.type === 'collection' ? JSON.stringify(['collection', group.id]) : 'unclassified'
}

/** Validate fixed selection intent; actual missing endpoints or unreadable crossed groups become SelectionChanged at execution. */
export function parseEntrySelection(input: unknown): EntrySelection {
  const endpoint = v.strictObject({ group: groupSchema, ref: entryRefSchema })
  const value = parseValue(
    v.variant('type', [
      v.strictObject({ type: v.literal('all') }),
      v.strictObject({ type: v.literal('range'), anchor: entryRefSchema, focus: entryRefSchema }),
      v.strictObject({
        type: v.literal('groupRange'),
        anchor: endpoint,
        focus: endpoint,
        expandedGroups: v.pipe(
          v.array(groupSchema),
          v.check((groups) => unique(groups, groupKey)),
        ),
      }),
    ]),
    input,
    'Invalid fixed entry selection',
  )
  if (value.type === 'groupRange') {
    const groups = new Set(value.expandedGroups.map(groupKey))
    if (!groups.has(groupKey(value.anchor.group)) || !groups.has(groupKey(value.focus.group))) {
      throw new DesktopError(
        'InvalidInput',
        'Selection endpoints must belong to declared expanded groups',
      )
    }
  }
  return value
}
