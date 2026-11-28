import type { NativeFiles } from '#native'
import { parseEntryMergeInput, type EntryMergeInput } from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import type { ChangeAdmission, dependencyStorage } from '../change-admission'
import { prepareMergeLocations } from '../holdings/merge'
import type { holdingStorage } from '../holdings/storage'
import type { CompleteWrite } from '../transaction'
import type { mergeStorage } from './commit'

export function entryMerge(
  call: DatabaseCall<
    ReturnType<typeof mergeStorage> &
      ReturnType<typeof dependencyStorage> &
      ReturnType<typeof holdingStorage>
  >,
  native: NativeFiles,
  resources: string,
  admit: ChangeAdmission,
  complete: CompleteWrite,
) {
  return async function merge<I extends EntryMergeInput>(
    raw: I,
    options?: CallOptions,
  ): Promise<I['target']> {
    const input = parseEntryMergeInput(raw),
      signal = options?.signal ?? new AbortController().signal
    const locations = await prepareMergeLocations(input, call, native, resources, signal),
      affected = await call('entryDependencies', [input.target, ...input.sources])
    signal.throwIfAborted()
    return complete(
      await admit(affected, () => call('mergeLibraryEntries', input, locations, affected)),
    ) as I['target']
  }
}
