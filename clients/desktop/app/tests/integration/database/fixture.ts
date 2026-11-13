/** @fileoverview Builds isolated database options and a nonempty fixture covering the formal storage families. */

import { join } from 'node:path'
import { entryTypes } from '@kisaki3/desktop-contracts/library'
import type { DatabaseOptions, Storage } from '../../../src/main/infrastructure/database'
import * as tables from '../../../src/main/infrastructure/database/schema'
import { ready } from '../../../src/main/infrastructure/database/codecs/json'
import { getPreferenceDefaults } from '../../../src/main/features/preferences/defaults'
import { appRoot } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'

/** Uses the actually prepared resources and a caller-owned disposable database location. */
export function storageOptions(
  directory: string,
  migrationsDirectory = join(appRoot, 'out/resources', hostTarget(), 'drizzle'),
): DatabaseOptions {
  if (
    process.platform !== 'win32' &&
    process.platform !== 'darwin' &&
    process.platform !== 'linux'
  ) {
    throw new Error('Unsupported desktop test platform')
  }
  return {
    path: join(directory, 'library.sqlite'),
    migrationsDirectory,
    nativeBinding: join(appRoot, 'out/resources', hostTarget(), 'native/better-sqlite3.node'),
    defaults: getPreferenceDefaults(process.platform, []),
  }
}

/** Creates seven actual entry types, five part kinds, all relation families and persistent resources. */
export function seedStorage(storage: Storage, directory: string): void {
  const times = { createdAt: 1, updatedAt: 1 }
  storage.db.transaction((db) => {
    db.insert(tables.entries)
      .values(
        entryTypes.map((type) => ({
          id: type,
          type,
          name: `資料 ${type}`,
          aliases: ['別名'],
          ...times,
        })),
      )
      .run()
    db.insert(tables.games)
      .values({
        entryId: 'game',
        releaseDate: { year: 0, month: 2, day: 29 },
        originalLanguages: ['ja'],
      })
      .run()
    db.insert(tables.animes)
      .values({ entryId: 'anime', releaseDate: { year: 2020 }, releaseStatus: 'ongoing' })
      .run()
    db.insert(tables.comics).values({ entryId: 'comic', declaredVolumeCount: 2 }).run()
    db.insert(tables.novels).values({ entryId: 'novel', declaredPageCount: 120 }).run()
    db.insert(tables.characters)
      .values({
        entryId: 'character',
        birthDate: { month: 2, day: 29 },
        age: { kind: 'text', value: '不明' },
      })
      .run()
    db.insert(tables.persons)
      .values({ entryId: 'person', birthDate: { year: -44 } })
      .run()
    db.insert(tables.organizations)
      .values({ entryId: 'organization', foundedDate: { year: 1900, month: 1 } })
      .run()

    db.insert(tables.animeEpisodes)
      .values({ id: 'episode', animeId: 'anime', numberLabel: '12.5', type: 'special', ...times })
      .run()
    db.insert(tables.animeExtras)
      .values({ id: 'extra', animeId: 'anime', type: 'opening', ...times })
      .run()
    db.insert(tables.comicVolumes)
      .values({ id: 'volume', comicId: 'comic', numberLabel: '上', ...times })
      .run()
    db.insert(tables.comicChapters)
      .values({ id: 'chapter', comicId: 'comic', numberLabel: '特別篇', ...times })
      .run()
    db.insert(tables.novelVolumes)
      .values({ id: 'novel-volume', novelId: 'novel', ...times })
      .run()
    db.insert(tables.comicVolumeChapters).values({ volumeId: 'volume', chapterId: 'chapter' }).run()
    db.insert(tables.entryExternalIdentities)
      .values({ source: 'fixture-source', sourceId: 'Exact/Ａ', ownerId: 'game' })
      .run()

    db.insert(tables.workCharacterLinks)
      .values({
        id: 'cast',
        workId: 'anime',
        workType: 'anime',
        characterId: 'character',
        role: 'main',
      })
      .run()
    db.insert(tables.workPersonLinks)
      .values({
        id: 'voice',
        workId: 'anime',
        workType: 'anime',
        personId: 'person',
        characterId: 'character',
        role: 'voiceActor',
        orderInCharacter: 0,
      })
      .run()
    db.insert(tables.workOrganizationLinks)
      .values({
        id: 'publisher',
        workId: 'novel',
        workType: 'novel',
        organizationId: 'organization',
        role: 'publisher',
      })
      .run()
    db.insert(tables.workRelations)
      .values({
        id: 'adaptation',
        fromId: 'anime',
        fromType: 'anime',
        toId: 'novel',
        toType: 'novel',
        type: 'adaptation',
      })
      .run()
    db.insert(tables.tags)
      .values({ id: 'tag', name: '分類', nameKey: '分類', ...times })
      .run()
    db.insert(tables.entryTags).values({ entryId: 'game', tagId: 'tag', note: '保持' }).run()
    db.insert(tables.collections)
      .values({ id: 'collection', name: '手動', ...times })
      .run()
    db.insert(tables.collectionMembers)
      .values({ collectionId: 'collection', entryId: 'anime' })
      .run()

    db.insert(tables.entryEvaluations).values({ entryId: 'game', rating: 85, favorite: true }).run()
    db.insert(tables.gameRecords)
      .values({ workId: 'game', status: 'active', additionalDurationMs: 1000 })
      .run()
    db.insert(tables.workCompletionRecords)
      .values({
        id: 'completed',
        workId: 'game',
        completedDate: { year: 0, month: 2, day: 29 },
        ...times,
      })
      .run()
    db.insert(tables.animeEpisodeRecords).values({ partId: 'episode', isCompleted: true }).run()
    db.insert(tables.animeFiles)
      .values({
        id: 'video',
        animeId: 'anime',
        path: join(directory, '映像.mkv'),
        availability: ready({
          status: 'unavailable',
          checkedAt: 2,
          reason: 'missing',
          error: { code: 'NotFound', message: 'Fixture file is offline' },
        }),
        ...times,
      })
      .run()
    db.insert(tables.animeFileEpisodes)
      .values({ fileId: 'video', partId: 'episode', isPreferred: true })
      .run()
    db.insert(tables.animeWatchActivity)
      .values({
        id: 'watched',
        animeId: 'anime',
        fileId: 'video',
        episodeId: 'episode',
        startedAt: 100,
        endedAt: 1100,
        durationMs: 500,
        contextNames: ready({ fileName: '映像.mkv', partName: '12.5' }),
      })
      .run()

    db.insert(tables.attachments)
      .values([
        {
          id: 'attachment',
          mediaType: 'application/zip',
          byteSize: 0,
          sha256: '0'.repeat(64),
          createdAt: 1,
        },
        {
          id: 'image',
          mediaType: 'image/png',
          byteSize: 68,
          sha256: '2'.repeat(64),
          width: 1,
          height: 1,
          createdAt: 1,
        },
      ])
      .run()
    db.insert(tables.notes)
      .values({
        id: 'note',
        title: '独立筆記',
        content: '# 原文',
        primaryImageId: 'image',
        ...times,
      })
      .run()
    db.insert(tables.noteEntryLinks).values({ noteId: 'note', entryId: 'game' }).run()
    db.insert(tables.animeAnnotations)
      .values({
        id: 'annotation',
        animeId: 'anime',
        fileId: 'video',
        content: '保存内容',
        location: ready({ type: 'position', positionSeconds: 2.5 }),
        ...times,
      })
      .run()
    db.insert(tables.gameLaunchConfigs)
      .values({
        id: 'launch',
        gameId: 'game',
        name: '設定',
        definition: ready({
          launch: { type: 'file', path: null },
          monitor: { type: 'process', name: null },
          timing: 'foreground',
          savePath: null,
          autoBackupEnabled: false,
          backupRetentionCount: null,
        }),
        ...times,
      })
      .run()
    db.insert(tables.gameSaveBackups)
      .values({
        id: 'backup',
        gameId: 'game',
        sourceConfigId: 'launch',
        sourceConfigName: '設定',
        sourcePath: join(directory, 'save'),
        sourceKind: 'directory',
        reason: 'manual',
        archiveAttachmentId: 'attachment',
        treeDigest: '1'.repeat(64),
        unpackedSizeBytes: 0,
        createdAt: 2,
      })
      .run()
    db.insert(tables.extensionStorage)
      .values({
        extensionId: 'fixture.extension',
        key: 'settings',
        value: ready({ enabled: true, selected: ['保留'] }),
        revision: 'revision-1',
      })
      .run()
    db.insert(tables.extensionSecrets)
      .values({
        extensionId: 'fixture.extension',
        key: 'secret',
        encryptedValue: Buffer.from([1, 2, 3]),
        revision: 'revision-2',
      })
      .run()
  })
}
