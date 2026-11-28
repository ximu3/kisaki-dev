import { mkdtemp, mkdir, rename, rm, copyFile, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect } from 'vite-plus/test'
import { loadNative } from '#native'
import { initializeDatabase } from '../../../src/main/infrastructure/database'
import type { DatabaseCall } from '../../../src/main/infrastructure/database/executor'
import { createSessionRegistry } from '../../../src/main/features/sessions/registry'
import { libraryStorage } from '../../../src/main/features/library/storage'
import { createRegistration } from '../../../src/main/features/library/holdings/registration/queue'
import { createDirectoryRelocation } from '../../../src/main/features/library/holdings/directories/relocate'
import { appRoot } from '../../../tools/lib/paths'
import { hostTarget } from '../../../tools/lib/targets'
import { storageOptions } from '../database/sample'

function direct<T extends Record<string, (...args: never[]) => unknown>>(
  operations: T,
): DatabaseCall<T> {
  return (async (name: string, ...args: unknown[]) =>
    operations[name]!(...(args as never[]))) as DatabaseCall<T>
}

test('a conflicting root blocks the entire relocation; a usable root commits only verified mappings', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'kisaki-relocation-'))
  const options = storageOptions(fixture)
  const storage = initializeDatabase(options)
  try {
    const db = libraryStorage(storage),
      call = direct(db),
      native = loadNative(options.collationExtension).files
    const work = {
      type: 'novel' as const,
      id: db.createLibraryEntry({ type: 'novel', name: 'Shelf' }, []).value.id,
    }
    const signal = new AbortController().signal
    const admission = createSessionRegistry()
    const take = <T>(r: { value: T }) => r.value
    const register = createRegistration(call, take, native, fixture, admission.change, () => {})
    const relocate = createDirectoryRelocation(
      call,
      take,
      native,
      fixture,
      admission.change,
      () => {},
    )
    const original = join(fixture, 'A'),
      occupied = join(fixture, 'B'),
      newRoot = join(fixture, 'C')
    await mkdir(original)
    await mkdir(occupied)
    await writeFile(join(original, 'one.txt'), 'first')
    await writeFile(join(original, 'missing.txt'), 'second')
    await writeFile(join(occupied, 'one.txt'), 'different')
    const directory = await register.directory(work, { path: original }, signal)
    await register.directory(work, { path: occupied }, signal)
    const first = await register.file(
      work,
      { path: join(original, 'one.txt'), note: 'keep' },
      signal,
    )
    const second = await register.file(work, { path: join(original, 'missing.txt') }, signal)
    const before = db.libraryPositions(work)
    const conflict = await relocate(work, directory.id, { path: occupied }, signal)
    expect(conflict.updated).toEqual([])
    expect(conflict.issues).toMatchObject([
      { target: { type: 'directory', id: directory.id }, status: 'conflict' },
    ])
    expect(db.libraryPositions(work)).toEqual(before)
    expect(await readFile(join(occupied, 'one.txt'), 'utf8')).toBe('different')

    await rename(original, newRoot)
    await rename(join(newRoot, 'missing.txt'), join(fixture, 'elsewhere.txt'))
    const moved = await relocate(
      work,
      directory.id,
      { path: newRoot, expected: { path: original } },
      signal,
    )
    expect(moved.updated).toHaveLength(2)
    expect(moved.issues).toMatchObject([
      { target: { type: 'file', id: second.id }, status: 'unverified' },
    ])
    expect(db.readWorkDirectory(work, directory.id, true)?.path).toBe(newRoot)
    expect(db.readWorkFile(work, first.id, true)).toMatchObject({
      id: first.id,
      path: join(newRoot, 'one.txt'),
      note: 'keep',
    })
    expect(db.readWorkFile(work, second.id, true)?.path).toBe(join(original, 'missing.txt'))
  } finally {
    storage.close()
    await rm(fixture, { recursive: true, force: true })
  }
})

test('directory collision retains selected game paths and external subtitles, and a retry moves only the selected settings', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'kisaki-group-relocation-'))
  const options = storageOptions(folder),
    storage = initializeDatabase(options)
  try {
    const db = libraryStorage(storage),
      call = direct(db),
      native = loadNative(options.collationExtension).files,
      admission = createSessionRegistry(),
      signal = new AbortController().signal,
      resourceRoot = join(appRoot, 'out', 'resources', hostTarget())
    const value = <T>(result: { value: T }) => result.value
    const add = createRegistration(call, value, native, resourceRoot, admission.change, () => {}),
      move = createDirectoryRelocation(
        call,
        value,
        native,
        resourceRoot,
        admission.change,
        () => {},
      )
    const first = join(folder, 'Old'),
      occupied = join(folder, 'Occupied'),
      destination = join(folder, 'New')
    for (const root of [first, occupied, destination]) {
      await mkdir(root)
      await writeFile(join(root, 'opening.srt'), '1\n00:00:00,000 --> 00:00:01,000\nOpening\n')
      await copyFile(
        join(appRoot, 'tests', 'fixtures', 'media', 'two-chapters.mkv'),
        join(root, 'opening.mkv'),
      )
    }
    const anime = {
      type: 'anime' as const,
      id: db.createLibraryEntry({ type: 'anime', name: 'Opening' }, []).value.id,
    }
    const game = {
      type: 'game' as const,
      id: db.createLibraryEntry({ type: 'game', name: 'Garden' }, []).value.id,
    }
    const animeDirectory = await add.directory(anime, { path: first }, signal),
      gameDirectory = await add.directory(game, { path: first }, signal)
    await add.directory(anime, { path: occupied }, signal)
    await add.directory(game, { path: occupied }, signal)
    const file = await add.file(anime, { path: join(first, 'opening.mkv') }, signal),
      originalSubtitle = join(first, 'opening.srt')
    db.updatePlaybackChoices(anime.id, file.id, {
      changes: {
        subtitleTrack: { type: 'external', index: 0, path: originalSubtitle },
        subtitleDelaySeconds: 0.5,
      },
    })
    const config = db.addGameConfig(game.id, {
      name: 'Garden',
      definition: {
        launch: { type: 'command', command: 'garden', workingDirectory: first },
        monitor: { type: 'directory', path: first },
        timing: 'foreground',
        savePath: first,
        autoBackupEnabled: false,
        backupRetentionCount: null,
      },
    }).value
    const subtitles = [{ fileId: file.id, paths: [originalSubtitle] }],
      configs = [{ launchConfigId: config, fields: ['workingDirectory', 'monitorPath'] }]
    const beforeFile = db.readWorkFile(anime, file.id, true),
      beforeConfig = db.getGameConfig(game.id, config, true)
    for (const [work, id, selection] of [
      [anime, animeDirectory.id, { subtitlePaths: subtitles }],
      [game, gameDirectory.id, { gameConfigFields: configs }],
    ] as const) {
      const report = await move(
        work,
        id,
        { path: occupied, expected: { path: first }, ...selection },
        signal,
      )
      expect(report.updated).toEqual([])
      expect(report.issues).toMatchObject([
        { target: { type: 'directory', id }, status: 'conflict' },
      ])
    }
    expect(db.readWorkFile(anime, file.id, true)).toEqual(beforeFile)
    expect(db.getGameConfig(game.id, config, true)).toEqual(beforeConfig)
    const relocatedAnime = await move(
      anime,
      animeDirectory.id,
      { path: destination, expected: { path: first }, subtitlePaths: subtitles },
      signal,
    )
    const relocatedGame = await move(
      game,
      gameDirectory.id,
      { path: destination, expected: { path: first }, gameConfigFields: configs },
      signal,
    )
    expect(relocatedAnime.issues).toEqual([])
    expect(relocatedGame.issues).toEqual([])
    expect(db.readWorkFile(anime, file.id, true)).toMatchObject({
      path: join(destination, 'opening.mkv'),
      playbackChoices: {
        value: {
          subtitleTrack: { path: join(destination, 'opening.srt') },
          subtitleDelaySeconds: 0.5,
        },
      },
    })
    expect(db.getGameConfig(game.id, config, true)).toMatchObject({
      definition: {
        value: {
          launch: { command: 'garden', workingDirectory: destination },
          monitor: { path: destination },
          savePath: first,
        },
      },
    })
  } finally {
    storage.close()
    await rm(folder, { recursive: true, force: true })
  }
})
