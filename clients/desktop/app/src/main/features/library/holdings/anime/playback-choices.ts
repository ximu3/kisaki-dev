import { isDeepStrictEqual } from 'node:util'
import { eq } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseFilePlaybackChoicesUpdate,
  type FilePlaybackChoicesApi,
} from '@kisaki3/desktop-contracts/library'
import type { Storage } from '../../../../infrastructure/database'
import { ready } from '../../../../infrastructure/database/codecs/json'
import { animeFiles } from '../../../../infrastructure/database/schema'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import { commit, expectFields, type CompleteWrite } from '../../transaction'
import { fileChange, fileRow } from '../files/record'

export function playbackChoiceStorage(storage: Storage) {
  return {
    playbackChoices: (id: string, file: string) => {
      const row = fileRow(storage.db, { type: 'anime', id }, file)
      return (row as typeof animeFiles.$inferSelect).playbackChoices
    },
    updatePlaybackChoices: (
      id: string,
      file: string,
      input: ReturnType<typeof parseFilePlaybackChoicesUpdate>,
    ) =>
      commit(storage, (write) => {
        const work = { type: 'anime' as const, id },
          row = fileRow(write.db, work, file) as typeof animeFiles.$inferSelect
        if (row.playbackChoices.status === 'invalid') {
          throw new DesktopError('DataIntegrityError', row.playbackChoices.error.message)
        }
        const before = row.playbackChoices.value
        expectFields(before, input.expected)
        const after = { ...before, ...input.changes }
        if (isDeepStrictEqual(before, after)) {
          return
        }
        write.db
          .update(animeFiles)
          .set({ playbackChoices: ready(after), updatedAt: write.now })
          .where(eq(animeFiles.id, file))
          .run()
        fileChange(write, work, [file])
      }),
  }
}

export function createPlaybackChoices(
  call: DatabaseCall<ReturnType<typeof playbackChoiceStorage>>,
  complete: CompleteWrite,
): FilePlaybackChoicesApi {
  return {
    get: (id, file) => call('playbackChoices', id, file),
    async update(id, file, raw, options) {
      options?.signal?.throwIfAborted()
      complete(await call('updatePlaybackChoices', id, file, parseFilePlaybackChoicesUpdate(raw)))
    },
  }
}
