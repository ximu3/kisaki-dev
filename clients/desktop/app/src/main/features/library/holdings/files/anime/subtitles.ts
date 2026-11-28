import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  DirectoryRelocationInput,
  FilePlaybackChoices,
} from '@kisaki3/desktop-contracts/library'
import { and, eq } from 'drizzle-orm'
import { ready } from '../../../../../infrastructure/database/codecs/json'
import type { DatabaseCall } from '../../../../../infrastructure/database/executor'
import { animeFiles } from '../../../../../infrastructure/database/schema'
import type { LibraryWrite } from '../../../transaction'
import type { ReportPathIssue, VerifyPath } from '../../paths'
import { fileChange } from '../record'
import type { fileCommands } from '../storage'

export interface SubtitleMove {
  id: string
  from: string
  to: string
}

export async function prepareSubtitleMoves(
  call: DatabaseCall<ReturnType<typeof fileCommands>>,
  workId: string,
  selections: NonNullable<DirectoryRelocationInput<'anime'>['subtitlePaths']>,
  verified: VerifyPath,
  issue: ReportPathIssue,
) {
  const moves: SubtitleMove[] = []
  const selected = new Set<string>()
  for (const selection of selections) {
    const file = await call('readWorkFile', { type: 'anime', id: workId }, selection.fileId, true)
    if (!file || !('playbackChoices' in file) || file.playbackChoices.status !== 'ready') {
      throw new DesktopError('InvalidReference', 'The selected subtitle file is unavailable')
    }
    for (const original of selection.paths) {
      const choice = file.playbackChoices.value.subtitleTrack
      if (choice?.type !== 'external' || choice.path !== original) {
        throw new DesktopError('Conflict', 'The chosen path is no longer the saved subtitle')
      }
      if (selected.has(file.id)) {
        continue
      }
      selected.add(file.id)
      try {
        const to = await verified(original, 'file')
        if (to) {
          moves.push({ id: file.id, from: original, to })
        }
      } catch (cause) {
        issue({ type: 'subtitle', fileId: file.id, path: original }, original, cause)
      }
    }
  }
  return moves
}

export function applySubtitleMoves(
  write: LibraryWrite,
  workId: string,
  moves: readonly SubtitleMove[],
) {
  for (const change of moves) {
    const where = and(eq(animeFiles.id, change.id), eq(animeFiles.animeId, workId))
    const row = write.db
      .select({ choices: animeFiles.playbackChoices })
      .from(animeFiles)
      .where(where)
      .get()
    if (row?.choices.status !== 'ready') {
      throw new DesktopError('Conflict', 'The saved subtitle choice changed')
    }
    const choice = row.choices.value.subtitleTrack
    if (choice?.type !== 'external' || choice.path !== change.from) {
      throw new DesktopError('Conflict', 'The saved subtitle path changed')
    }
    const next: FilePlaybackChoices = {
      ...row.choices.value,
      subtitleTrack: { ...choice, path: change.to },
    }
    write.db
      .update(animeFiles)
      .set({ playbackChoices: ready(next), updatedAt: write.now })
      .where(where)
      .run()
    fileChange(write, { type: 'anime', id: workId }, [change.id])
  }
}
