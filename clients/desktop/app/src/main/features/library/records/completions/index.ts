import {
  parseCompletionCreate,
  parseCompletionCreateMany,
  parseCompletionInitialization,
  parseCompletionUpdate,
  parseWorkRef,
} from '@kisaki3/desktop-contracts/library'
import type {
  WorkRef,
  WorkType,
  WorkCompletion,
  CompletionCreateItem,
} from '@kisaki3/desktop-contracts/library'
import { parseListOptions, type CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import type { CompleteWrite } from '../../transaction'
import type { completionStorage } from './storage'
import { completionQuery } from './statistics'

export function createCompletions(
  call: DatabaseCall<ReturnType<typeof completionStorage>>,
  sensitive: () => boolean,
  complete: CompleteWrite,
) {
  async function record(raw: unknown, clear: boolean, options?: CallOptions) {
    const items = parseCompletionCreateMany(raw)
    options?.signal?.throwIfAborted()
    return complete(await call('recordCompletions', items, clear))
  }
  async function add(work: unknown, input: unknown, clear: boolean, options?: CallOptions) {
    const row = { work: parseWorkRef(work), ...parseCompletionCreate(input) }
    options?.signal?.throwIfAborted()
    return complete(await call('recordCompletions', [row], clear))[0]!.completionId
  }
  return {
    statistics: (raw: unknown) => call('summarizeCompletions', completionQuery(raw), sensitive()),
    async list<T extends WorkType>(target: WorkRef<T>, options: unknown) {
      const page = await call(
        'readCompletions',
        parseWorkRef(target),
        parseListOptions(options),
        sensitive(),
      )
      return { total: page.total, items: page.items.map((item) => ({ ...item, work: target })) }
    },
    get: <T extends WorkType>(target: WorkRef<T>, id: string) =>
      call(
        'readCompletion',
        parseWorkRef(target),
        id,
        sensitive(),
      ) as Promise<WorkCompletion<T> | null>,
    create: (work: unknown, input: unknown, options?: CallOptions) =>
      add(work, input, false, options),
    recordCurrent: (work: unknown, input: unknown, options?: CallOptions) =>
      add(work, input, true, options),
    createMany: async (raw: unknown, options?: CallOptions) =>
      (await record(raw, false, options)).map((row) => row.completionId),
    async recordCurrentMany<T extends WorkType>(
      raw: readonly CompletionCreateItem<T>[],
      options?: CallOptions,
    ) {
      const saved = await record(raw, true, options)
      return saved.map((row) => ({ ...row, work: row.work as WorkRef<T> }))
    },
    async initialize(work: unknown, input: unknown, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      return complete(
        await call('initializeHistory', parseWorkRef(work), parseCompletionInitialization(input)),
      )
    },
    async update(work: unknown, id: string, input: unknown, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      complete(await call('changeCompletion', parseWorkRef(work), id, parseCompletionUpdate(input)))
    },
    async delete(work: unknown, id: string, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      complete(await call('changeCompletion', parseWorkRef(work), id, null))
    },
  }
}
