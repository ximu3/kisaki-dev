import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parsePartCreate,
  parsePartUpdate,
  parsePartRef,
  parsePartQuery,
  parsePartKindChange,
  parseMoveInput,
  parseReorderInput,
} from '@kisaki3/desktop-contracts/library'
import {
  parseListOptions,
  type CallOptions,
  type ListResult,
} from '@kisaki3/desktop-contracts/operations'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import type { createAttachments } from '../../../infrastructure/attachments'
import type { CompleteWrite } from '../transaction'
import { imageIds, prepareImages } from '../attachments'
import type { partStorage } from './storage'
import { volumeChapters } from './volume-chapters'
import type { ChangeAdmission } from '../../../infrastructure/use-targets'
import type { PartDependents } from './identity'
import type {
  PartRef,
  PartDetails,
  PartQuery,
  PartType,
  PartCreate,
  PartsApi,
} from '@kisaki3/desktop-contracts/library'
import type { UseTarget } from '../../../infrastructure/use-targets'
export function createParts(
  call: DatabaseCall<ReturnType<typeof partStorage>>,
  attachments: ReturnType<typeof createAttachments>,
  complete: CompleteWrite,
  sensitive: () => boolean,
  admit: ChangeAdmission,
) {
  async function changeIdentity<T>(
    refs: readonly PartRef[],
    options: CallOptions | undefined,
    apply: (baseline: PartDependents) => Promise<T>,
    survivor?: PartRef,
  ) {
    const baseline = await call('partDependents', refs)
    const targets: UseTarget[] = baseline.flatMap(({ ref, work, files }) => [
      { type: 'part', kind: ref.type, id: ref.id },
      ...(ref.id === survivor?.id
        ? []
        : files.map((id) => ({ type: 'file' as const, kind: work.type, id }))),
    ])
    options?.signal?.throwIfAborted()
    return admit(targets, () => apply(baseline))
  }
  function refs(input: unknown) {
    const items = (Array.isArray(input) ? input : [input]).map(parsePartRef)
    if (
      !items.length ||
      new Set(items.map((ref) => ref.type + '#' + ref.id)).size !== items.length
    ) {
      throw new DesktopError('InvalidInput', 'Choose distinct parts')
    }
    return items
  }

  async function completion(raw: unknown, done: boolean, options?: CallOptions) {
    if (typeof done !== 'boolean') {
      throw new DesktopError('InvalidInput', 'Choose a completion status')
    }
    options?.signal?.throwIfAborted()
    complete(await call('completeLibraryParts', refs(raw), done))
  }
  async function arrange(raw: unknown, value: unknown, move: boolean, options?: CallOptions) {
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('work' in raw) ||
      !('partType' in raw) ||
      Object.keys(raw).length !== 2
    ) {
      throw new DesktopError('InvalidInput', 'Invalid part order scope')
    }
    const scope = parsePartQuery({ ...raw, search: '' })
    options?.signal?.throwIfAborted()
    complete(
      await call(
        'orderLibraryParts',
        scope,
        move ? parseMoveInput(value) : parseReorderInput(value),
      ),
    )
  }
  return {
    get: <T extends PartType>(raw: PartRef<T>) =>
      call('readLibraryPart', parsePartRef(raw), sensitive()) as Promise<PartDetails<T> | null>,
    list<Q extends PartQuery>(raw: Q, range: unknown) {
      // The validated part type selects the table read by the worker.
      return call(
        'listLibraryParts',
        parsePartQuery(raw),
        parseListOptions(range),
        sensitive(),
      ) as unknown as Promise<ListResult<PartDetails<Q['partType']>>>
    },
    async create<I extends PartCreate>(raw: I, options?: CallOptions): Promise<PartRef<I['type']>> {
      const { prepared = [], ...input } = parsePartCreate(raw)
      const hold = await prepareImages(attachments, imageIds(input.data), prepared)
      try {
        options?.signal?.throwIfAborted()
        return complete(await call('addLibraryPart', input, hold.records)) as PartRef<I['type']>
      } finally {
        await hold.dispose()
      }
    },
    async update(ref: unknown, raw: unknown, options?: CallOptions) {
      if (!raw || typeof raw !== 'object' || 'ref' in raw) {
        throw new DesktopError('InvalidInput', 'Expected part changes')
      }
      const { prepared = [], ...input } = parsePartUpdate({ ...raw, ref })
      const hold = await prepareImages(attachments, imageIds(input.changes), prepared)
      try {
        options?.signal?.throwIfAborted()
        complete(await call('editLibraryPart', input, hold.records))
      } finally {
        await hold.dispose()
      }
    },
    setCompleted: completion,
    setCompletedMany: completion,
    async changeKind<Args extends Parameters<PartsApi['changeKind']>>(
      ...[raw, value, options]: Args
    ): Promise<PartRef<Args[1]['target']['kind']>> {
      const ref = parsePartRef(raw)
      if (ref.type !== 'animeEpisode' && ref.type !== 'animeExtra') {
        throw new DesktopError('InvalidInput', 'Choose an anime episode or extra')
      }
      const target = { id: ref.id, type: ref.type }
      const { prepared = [], ...input } = parsePartKindChange(target, value)
      const hold = await prepareImages(attachments, imageIds(input.changes), prepared)
      try {
        options?.signal?.throwIfAborted()
        return complete(
          await changeIdentity([ref], options, (baseline) =>
            call('changeLibraryPartKind', target, input, hold.records, baseline),
          ),
        ) as PartRef<Args[1]['target']['kind']>
      } finally {
        await hold.dispose()
      }
    },
    async merge<I extends Parameters<PartsApi['merge']>[0]>(
      raw: I,
      options?: CallOptions,
    ): Promise<I['target']> {
      if (
        !raw ||
        typeof raw !== 'object' ||
        Object.keys(raw).length !== 2 ||
        !('source' in raw) ||
        !('target' in raw)
      ) {
        throw new DesktopError('InvalidInput', 'Choose a source and target')
      }
      options?.signal?.throwIfAborted()
      const source = parsePartRef(raw.source),
        target = parsePartRef(raw.target)
      return complete(
        await changeIdentity(
          [source, target],
          options,
          (baseline) => call('mergeLibraryParts', source, target, baseline),
          target,
        ),
      ) as I['target']
    },
    async delete(raw: unknown, options?: CallOptions) {
      options?.signal?.throwIfAborted()
      const parts = refs(raw)
      complete(
        await changeIdentity(parts, options, (baseline) =>
          call('deleteLibraryParts', parts, baseline),
        ),
      )
    },
    reorder: (scope: unknown, input: unknown, options?: CallOptions) =>
      arrange(scope, input, false, options),
    move: (scope: unknown, input: unknown, options?: CallOptions) =>
      arrange(scope, input, true, options),
    volumeChapters: volumeChapters(call, complete),
  }
}
