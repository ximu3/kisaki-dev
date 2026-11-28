import * as v from 'valibot'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseEntryRef,
  parseCollectionMemberChange,
  parseTagEntryChange,
  parseMoveInput,
  parseReorderInput,
  type CollectionMembersApi,
  type TagEntriesApi,
  type CollectionMember,
  type TagEntry,
} from '@kisaki3/desktop-contracts/library'
import { parseListOptions, type CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import type { CompleteWrite } from '../../transaction'
import type { organizerStorage } from '../storage'
import type { Organizer } from './storage'

function inputObject<T>(schema: v.GenericSchema<unknown, T>, input: unknown): T {
  const result = v.safeParse(schema, input)
  if (!result.success) {
    throw new DesktopError('InvalidInput', 'Invalid organizer membership', { cause: result.issues })
  }
  return result.output
}
export function memberships(
  call: DatabaseCall<ReturnType<typeof organizerStorage>>,
  complete: CompleteWrite,
  sensitive: () => boolean,
) {
  const note = v.nullable(v.string()),
    properties = { note: v.exactOptional(note), isSpoiler: v.exactOptional(v.boolean()) }
  function actions(kind: Organizer) {
    const parse = kind === 'tag' ? parseTagEntryChange : parseCollectionMemberChange
    return {
      list: (id: string, range: unknown) =>
        call('listOrganizerMembers', kind, id, parseListOptions(range), sensitive()),
      async applyChanges(id: string, raw: unknown, options?: CallOptions) {
        const input = inputObject(
          v.strictObject({ change: v.unknown(), expected: v.exactOptional(v.array(v.unknown())) }),
          raw,
        )
        const change = parse(input.change)
        let baseline: readonly (CollectionMember | TagEntry)[] | undefined
        if (input.expected !== undefined) {
          if (change.type !== 'replace') {
            throw new DesktopError('InvalidInput', 'Only replacement has a full member baseline')
          }
          const member =
            kind === 'tag'
              ? v.strictObject({ entry: v.unknown(), note, isSpoiler: v.boolean() })
              : v.strictObject({ entry: v.unknown(), note })
          for (const value of input.expected) {
            inputObject(member, value)
          }
          const parsed = parse({ type: 'replace', items: input.expected })
          if (parsed.type === 'replace') {
            baseline = parsed.items as readonly (TagEntry | CollectionMember)[]
          }
        }
        options?.signal?.throwIfAborted()
        complete(await call('changeOrganizerMembers', kind, id, change, baseline))
      },
      async update(id: string, raw: unknown, input: unknown, options?: CallOptions) {
        const entry = parseEntryRef(raw)
        const change =
          kind === 'tag'
            ? inputObject(
                v.strictObject({
                  changes: v.strictObject(properties),
                  expected: v.exactOptional(v.strictObject(properties)),
                }),
                input,
              )
            : (() => {
                const r = inputObject(
                  v.strictObject({ note, expected: v.exactOptional(v.strictObject({ note })) }),
                  input,
                )
                return { changes: { note: r.note }, expected: r.expected }
              })()
        if (Object.keys(change.expected ?? {}).some((key) => !Object.hasOwn(change.changes, key))) {
          throw new DesktopError('InvalidInput', 'A baseline must refer to an edited attribute')
        }
        options?.signal?.throwIfAborted()
        complete(
          await call('setOrganizerMemberFields', kind, id, entry, change.changes, change.expected),
        )
      },
      async reorder(id: string, raw: unknown, options?: CallOptions) {
        const parsed = inputObject(
            v.strictObject({
              order: v.array(v.unknown()),
              expected: v.strictObject({ order: v.array(v.unknown()) }),
            }),
            raw,
          ),
          order = parsed.order.map(parseEntryRef),
          before = parsed.expected.order.map(parseEntryRef)
        const input = parseReorderInput({
          order: order.map((r) => r.id),
          expected: { order: before.map((r) => r.id) },
        })
        options?.signal?.throwIfAborted()
        complete(await call('orderOrganizerMembers', kind, id, input, [...order, ...before]))
      },
      async move(id: string, raw: unknown, options?: CallOptions) {
        const parsed = inputObject(
            v.strictObject({ ids: v.array(v.unknown()), before: v.nullable(v.unknown()) }),
            raw,
          ),
          ids = parsed.ids.map(parseEntryRef),
          before = parsed.before === null ? null : parseEntryRef(parsed.before)
        const input = parseMoveInput({ ids: ids.map((r) => r.id), before: before?.id ?? null })
        options?.signal?.throwIfAborted()
        complete(
          await call('orderOrganizerMembers', kind, id, input, before ? [...ids, before] : ids),
        )
      },
    }
  }
  return {
    members: actions('collection') as CollectionMembersApi,
    entries: actions('tag') as TagEntriesApi,
  }
}
