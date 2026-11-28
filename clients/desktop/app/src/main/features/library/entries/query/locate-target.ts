import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  EntryRef,
  GameLaunchConfig,
  HeldFile,
  PartDetails,
  PartRef,
} from '@kisaki3/desktop-contracts/library'
import type { EntryViewTarget } from '@kisaki3/desktop-contracts/ui'
import { and, eq } from 'drizzle-orm'
import type { Storage } from '../../../../infrastructure/database'
import {
  comicVolumeChapters,
  entries,
  gameLaunchConfigs,
} from '../../../../infrastructure/database/schema'
import { readFile } from '../../holdings/files/read'
import { getPart } from '../../parts/write'
import { findIdentity } from '../external-ids'
import { entryWhere } from '../tables'

export function navigationStorage(storage: Storage) {
  return {
    locateViewTarget: (input: EntryViewTarget, sensitive: boolean) =>
      storage.transaction((db) => {
        const ref: EntryRef | null =
          input.identifier.type === 'local'
            ? { type: input.entryType, id: input.identifier.id }
            : findIdentity(db, input.identifier)
        if (
          !ref ||
          ref.type !== input.entryType ||
          !db
            .select({ id: entries.id })
            .from(entries)
            .where(and(entryWhere(ref), sensitive ? undefined : eq(entries.isNsfw, false)))
            .get()
        ) {
          throw new DesktopError('NotFound', 'The entry is unavailable')
        }
        const location: {
          entry: EntryRef
          parts: PartDetails[]
          file?: HeldFile
          config?: GameLaunchConfig
        } = { entry: ref, parts: [] }
        if (input.entryType === 'game' && input.launchConfigId) {
          const row = db
            .select()
            .from(gameLaunchConfigs)
            .where(
              and(
                eq(gameLaunchConfigs.gameId, ref.id),
                eq(gameLaunchConfigs.id, input.launchConfigId),
              ),
            )
            .get()
          if (!row) {
            throw new DesktopError('NotFound', 'The launch configuration is unavailable')
          }
          location.config = row
        }
        function part(type: PartRef['type'], id: string | undefined) {
          if (!id) {
            return
          }
          const row = getPart(db, { type, id })
          if (!row || row.work.id !== ref!.id) {
            throw new DesktopError(
              'InvalidReference',
              'The selected part does not belong to this work',
            )
          }
          location.parts.push(row)
        }
        if (input.entryType === 'anime') {
          part('animeEpisode', input.episodeId)
          part('animeExtra', input.extraId)
        }
        if (input.entryType === 'novel') {
          part('novelVolume', input.volumeId)
        }
        if (input.entryType === 'comic') {
          part('comicVolume', input.volumeId)
          part('comicChapter', input.chapterId)
          if (
            input.volumeId &&
            input.chapterId &&
            !db
              .select({ id: comicVolumeChapters.chapterId })
              .from(comicVolumeChapters)
              .where(
                and(
                  eq(comicVolumeChapters.volumeId, input.volumeId),
                  eq(comicVolumeChapters.chapterId, input.chapterId),
                ),
              )
              .get()
          ) {
            throw new DesktopError(
              'InvalidReference',
              'The specified chapter is not a member of this volume',
            )
          }
        }
        if ('fileId' in input && input.fileId) {
          const file = readFile(db, { type: input.entryType, id: ref.id }, input.fileId),
            part = location.parts.at(-1)?.ref
          if (
            part &&
            !file.associations.some(
              (item) => item.part.id === part.id && item.part.type === part.type,
            )
          ) {
            throw new DesktopError(
              'InvalidReference',
              'The file is not linked to the selected part',
            )
          }
          location.file = file
        }
        return location
      }),
  }
}
