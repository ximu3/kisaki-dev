import type { Attachment } from '@kisaki3/desktop-contracts/attachments'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseEntryRef,
  parseMoveInput,
  parseOrganizerMerge,
  parseReorderInput,
} from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { PreparedAttachment } from '@kisaki3/desktop-contracts/resources'
import * as v from 'valibot'
import type { createAttachments } from '../../../infrastructure/attachments'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import { imageIds, prepareImages } from '../attachments'
import type { CompleteWrite, LibraryCommit } from '../transaction'
import type { organizerStorage } from './storage'

export type Organizer = 'collection' | 'tag'

export type OrganizerCall = DatabaseCall<ReturnType<typeof organizerStorage>>

export type OrganizerWrites = ReturnType<typeof organizerWrites>

export function organizerWrites(
  call: OrganizerCall,
  attachments: ReturnType<typeof createAttachments>,
  complete: CompleteWrite,
) {
  async function save<T>(
    fields: object,
    prepared: readonly PreparedAttachment[] | undefined,
    options: CallOptions | undefined,
    persist: (images: readonly Attachment[]) => Promise<LibraryCommit<T>>,
  ) {
    options?.signal?.throwIfAborted()
    const hold = await prepareImages(attachments, imageIds(fields), prepared ?? [])
    try {
      options?.signal?.throwIfAborted()
      return complete(await persist(hold.records))
    } finally {
      await hold.dispose()
    }
  }

  async function remove(kind: Organizer, id: string, options?: CallOptions) {
    options?.signal?.throwIfAborted()
    complete(await call('deleteOrganizer', kind, id))
  }
  async function merge(kind: Organizer, input: unknown, options?: CallOptions) {
    options?.signal?.throwIfAborted()
    return complete(await call('mergeOrganizers', kind, parseOrganizerMerge(input)))
  }
  return { save, remove, merge }
}

export function inputObject<T>(schema: v.GenericSchema<unknown, T>, input: unknown): T {
  const result = v.safeParse(schema, input)
  if (!result.success) {
    throw new DesktopError('InvalidInput', 'Invalid organizer membership', { cause: result.issues })
  }
  return result.output
}

export function entryOrder(raw: unknown) {
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
  return { input, refs: [...order, ...before] }
}

export function entryMove(raw: unknown) {
  const parsed = inputObject(
      v.strictObject({ ids: v.array(v.unknown()), before: v.nullable(v.unknown()) }),
      raw,
    ),
    ids = parsed.ids.map(parseEntryRef),
    before = parsed.before === null ? null : parseEntryRef(parsed.before)
  const input = parseMoveInput({ ids: ids.map((r) => r.id), before: before?.id ?? null })
  return { input, refs: before ? [...ids, before] : ids }
}
