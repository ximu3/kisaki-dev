import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseEntryRef,
  parseEntryMergeInput,
  type EntryMergeInput,
} from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import type { NativeFiles } from '#native'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import type { ChangeAdmission } from '../../change-admission'
import type { CompleteWrite } from '../../transaction'
import type { holdingStorage } from '../../holdings/storage'
import type { identityStorage } from './storage'
import { prepareMergeLocations } from './locations'

export function identityOperations(
  call: DatabaseCall<ReturnType<typeof identityStorage> & ReturnType<typeof holdingStorage>>,
  native: NativeFiles,
  resources: string,
  admit: ChangeAdmission,
  complete: CompleteWrite,
) {
  return {
    async merge<I extends EntryMergeInput>(raw: I, options?: CallOptions): Promise<I['target']> {
      const input = parseEntryMergeInput(raw),
        signal = options?.signal ?? new AbortController().signal
      const locations = await prepareMergeLocations(input, call, native, resources, signal),
        affected = await call('entryDependencies', [input.target, ...input.sources])
      signal.throwIfAborted()
      return complete(
        await admit(affected, () => call('mergeLibraryEntries', input, locations, affected)),
      ) as I['target']
    },
    async delete(raw: unknown, options?: CallOptions) {
      if (!Array.isArray(raw) || !raw.length) {
        throw new DesktopError('InvalidInput', 'Select one or more entries')
      }
      const refs = raw.map(parseEntryRef)
      if (new Set(refs.map((ref) => ref.id)).size !== refs.length) {
        throw new DesktopError('InvalidInput', 'Select each entry once')
      }
      const affected = await call('entryDependencies', refs)
      options?.signal?.throwIfAborted()
      complete(await admit(affected, () => call('deleteLibraryEntries', refs, affected)))
    },
  }
}
