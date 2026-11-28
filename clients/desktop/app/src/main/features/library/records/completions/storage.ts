import type {
  CompletionCreateItem,
  CompletionInitialization,
  CompletionUpdate,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'
import type { ListOptions } from '@kisaki3/desktop-contracts/operations'
import type { Storage } from '../../../../infrastructure/database'
import { commit } from '../../transaction'
import { recordBatch, editCompletion, initializeHistory } from './write'
import { getCompletion, listCompletions } from './read'
import { completionStats, type completionQuery } from './statistics'

export function completionStorage(storage: Storage) {
  return {
    summarizeCompletions: (query: ReturnType<typeof completionQuery>, sensitive: boolean) =>
      storage.transaction((db) => completionStats(db, query, sensitive)),
    readCompletion: (work: WorkRef, id: string, showSensitive: boolean) =>
      storage.transaction((db) => getCompletion(db, work, id, showSensitive)),
    readCompletions: (work: WorkRef, options: ListOptions, showSensitive: boolean) =>
      storage.transaction((db) => listCompletions(db, work, options, showSensitive)),
    recordCompletions: (items: readonly CompletionCreateItem[], clearStatus: boolean) =>
      commit(storage, (write) => recordBatch(write, items, clearStatus)),
    initializeHistory: (work: WorkRef, input: CompletionInitialization) =>
      commit(storage, (write) => initializeHistory(write, work, input)),
    changeCompletion: (work: WorkRef, id: string, input: CompletionUpdate | null) =>
      commit(storage, (write) => editCompletion(write, work, id, input)),
  }
}
