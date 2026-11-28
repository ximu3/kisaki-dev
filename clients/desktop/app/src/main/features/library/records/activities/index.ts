import {
  parseActivityCreate,
  parseActivityUpdate,
  parseWorkRef,
  type WorkRef,
  type WorkType,
  type Activity,
} from '@kisaki3/desktop-contracts/library'
import { parseListOptions, type CallOptions } from '@kisaki3/desktop-contracts/operations'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import type { CompleteWrite } from '../../transaction'
import { activityQuery } from './query'
import type { activityStorage } from './storage'

import type { ChangeAdmission } from '../../../../infrastructure/use-targets'
export function createActivities(
  call: DatabaseCall<ReturnType<typeof activityStorage>>,
  complete: CompleteWrite,
  sensitive: () => boolean,
  admit: ChangeAdmission,
) {
  return {
    list: (query: unknown, range: unknown) =>
      call('listActivities', activityQuery(query, false), parseListOptions(range), sensitive()),
    get: <T extends WorkType>(work: WorkRef<T>, id: string) =>
      call('readActivity', parseWorkRef(work), id, sensitive()) as Promise<Activity<T> | null>,
    statistics: (query: unknown) =>
      call('summarizeActivities', activityQuery(query, true), sensitive()),
    async create(raw: unknown, options?: CallOptions) {
      const input = parseActivityCreate(raw, Date.now())
      options?.signal?.throwIfAborted()
      return complete(await call('addActivity', input))
    },
    async update(raw: unknown, id: string, input: unknown, options?: CallOptions) {
      const work = parseWorkRef(raw)
      options?.signal?.throwIfAborted()
      const fields = parseActivityUpdate(work, input, Date.now())
      complete(
        await admit([{ type: 'activity', kind: work.type, id }], () =>
          call('editActivity', work, id, fields),
        ),
      )
    },
    async delete(raw: unknown, ids: unknown, options?: CallOptions) {
      const selected = typeof ids === 'string' ? [ids] : ids
      if (
        !Array.isArray(selected) ||
        !selected.length ||
        !selected.every((id): id is string => typeof id === 'string' && !!id.trim()) ||
        new Set(selected).size !== selected.length
      ) {
        throw new DesktopError('InvalidInput', 'Select distinct activities')
      }
      options?.signal?.throwIfAborted()
      const work = parseWorkRef(raw)
      complete(
        await admit(
          selected.map((id) => ({ type: 'activity', kind: work.type, id })),
          () => call('deleteActivities', work, selected),
        ),
      )
    },
  }
}
