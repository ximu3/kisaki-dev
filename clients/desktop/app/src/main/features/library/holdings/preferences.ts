import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  FilePreferenceChangeByType,
  FilePreferencesByType,
  FileWorkType,
  HoldingsPreferencesApi,
  UsagePreferenceTarget,
  WorkRef,
} from '@kisaki3/desktop-contracts/library'
import type { CallOptions, StoredValue } from '@kisaki3/desktop-contracts/operations'
import {
  parseAnimePlaybackPreferences,
  parsePlaybackOverrideChange,
  parseReadingOverrideChange,
  parseReadingPreferences,
  type PlaybackOverrideChange,
  type PreferencesSnapshot,
  type ReadingOverrideChange,
  type UsageOverride,
} from '@kisaki3/desktop-contracts/preferences'
import { eq, sql } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'
import type { Storage } from '../../../infrastructure/database'
import type { DatabaseCall } from '../../../infrastructure/database/executor'
import * as s from '../../../infrastructure/database/schema'
import {
  animePlaybackPreferences,
  comicReadingPreferences,
  novelReadingPreferences,
} from '../../../infrastructure/database/schema'
import { requireEntry } from '../entries/tables'
import {
  commit,
  expectFields,
  type CompleteWrite,
  type LibraryDatabase,
  type LibraryWrite,
} from '../transaction'
import { playbackChoiceStorage } from './files/anime/playback-choices'
import { fileChange, fileRow, type FileWork } from './files/record'
import { mediaFiles } from './files/tables'

export function movePreferences(write: LibraryWrite, source: FileWork, target: FileWork) {
  const { db } = write
  const table = {
    anime: s.animePlaybackPreferences,
    comic: s.comicReadingPreferences,
    novel: s.novelReadingPreferences,
  }[target.type]
  if (!db.select({ id: table.ownerId }).from(table).where(eq(table.ownerId, target.id)).get()) {
    db.update(table).set({ ownerId: target.id }).where(eq(table.ownerId, source.id)).run()
  }
}

const overrides = {
  anime: animePlaybackPreferences,
  comic: comicReadingPreferences,
  novel: novelReadingPreferences,
}

type Settings = FilePreferencesByType[FileWorkType]

type Change = PlaybackOverrideChange | ReadingOverrideChange

function target(raw: UsagePreferenceTarget): UsagePreferenceTarget {
  if (raw?.type === 'work' && Object.keys(raw).length === 1) {
    return raw
  }
  if (
    raw?.type === 'file' &&
    typeof raw.fileId === 'string' &&
    raw.fileId &&
    Object.keys(raw).length === 2
  ) {
    return raw
  }
  throw new DesktopError('InvalidInput', 'Choose work or file settings')
}

function get(
  db: LibraryDatabase,
  work: FileWork,
  at: UsagePreferenceTarget,
): StoredValue<UsageOverride<Settings>> | null {
  if (at.type === 'file') {
    return fileRow(db, work, at.fileId).preferences
  }
  requireEntry(db, work)
  const table = overrides[work.type]
  return (
    db.select({ value: table.settings }).from(table).where(eq(table.ownerId, work.id)).get()
      ?.value ?? null
  )
}

function unpack<T>(value: StoredValue<T>) {
  if (value.status === 'invalid') {
    throw new DesktopError('DataIntegrityError', value.error.message)
  }
  return value.value
}

function overlay(
  original: Settings,
  change: NonNullable<Extract<Change, { type: 'update' }>['changes']['settings']>,
) {
  const value = { ...original, ...change }
  if ('pages' in original && 'pages' in change) {
    Object.assign(value, { pages: { ...original.pages, ...change.pages } })
  }
  if ('text' in original && 'text' in change) {
    Object.assign(value, { text: { ...original.text, ...change.text } })
  }
  return value
}

function save(
  current: StoredValue<UsageOverride<Settings>> | null,
  change: Change,
  medium: FileWorkType,
) {
  if (change.type === 'initialize') {
    if (current?.status === 'ready') {
      throw new DesktopError('Conflict', 'The settings have already been initialized')
    }
    return { enabled: change.enabled, settings: change.settings }
  }
  if (!current) {
    throw new DesktopError('Conflict', 'Initialize these settings first')
  }
  const original = unpack(current)
  const { changes, expected } = change
  if (expected?.enabled !== undefined) {
    expectFields(original, { enabled: expected.enabled })
  }
  if (
    expected?.settings &&
    !isDeepStrictEqual(overlay(original.settings, expected.settings), original.settings)
  ) {
    throw new DesktopError('Conflict', 'The selected settings changed')
  }
  const merged = changes.settings ? overlay(original.settings, changes.settings) : original.settings
  return {
    enabled: changes.enabled ?? original.enabled,
    settings:
      medium === 'anime' ? parseAnimePlaybackPreferences(merged) : parseReadingPreferences(merged),
  }
}

export function preferenceStorage(storage: Storage) {
  return {
    getHoldingPreferences: (work: FileWork, at: UsagePreferenceTarget) =>
      storage.transaction((db) => get(db, work, at)),
    effectiveHoldingPreferences: (work: FileWork, id: string) =>
      storage.transaction((db) => {
        for (const at of [{ type: 'file', fileId: id }, { type: 'work' }] as const) {
          const stored = get(db, work, at)
          if (stored) {
            const value = unpack(stored)
            if (value.enabled) {
              return { source: at.type, settings: value.settings }
            }
          }
        }
        return null
      }),
    updateHoldingPreferences: (work: FileWork, at: UsagePreferenceTarget, change: Change) =>
      commit(storage, (write) => {
        const current = get(write.db, work, at),
          value = save(current, change, work.type)
        if (current?.status === 'ready' && isDeepStrictEqual(current.value, value)) {
          return value
        }
        const data = JSON.stringify(value)
        if (at.type === 'file') {
          const table = mediaFiles[work.type].table
          write.db.run(
            sql`update ${table} set preferences=${data},updated_at=${write.now} where id=${at.fileId}`,
          )
          fileChange(write, work, [at.fileId])
        } else {
          const table = overrides[work.type],
            owner = sql.identifier(table.ownerId.name)
          write.db.run(
            sql`insert into ${table} (${owner},settings) values (${work.id},${data}) on conflict(${owner}) do update set settings=excluded.settings`,
          )
          write.changes.push({ type: 'holdingsChanged', work } as Extract<
            LibraryWrite['changes'][number],
            { type: 'holdingsChanged' }
          >)
        }
        return value
      }),
    ...playbackChoiceStorage(storage),
  }
}

export function holdingPreferences(
  call: DatabaseCall<ReturnType<typeof preferenceStorage>>,
  complete: CompleteWrite,
  global: () => PreferencesSnapshot['usage'],
) {
  function defaults(type: FileWorkType): Settings {
    const prefs = global()
    if (type === 'anime') {
      return prefs.anime
    }
    const { text, ...rest } = prefs[type]
    return { ...rest, text: { ...text, font: unpack(text.font) } }
  }
  const preferences: HoldingsPreferencesApi = {
    async get<T extends FileWorkType>(work: WorkRef<T>, at: UsagePreferenceTarget) {
      return (await call('getHoldingPreferences', work, target(at))) as StoredValue<
        UsageOverride<FilePreferencesByType[T]>
      > | null
    },
    async update<
      Args extends {
        [K in FileWorkType]: [
          work: WorkRef<K>,
          target: UsagePreferenceTarget,
          input: FilePreferenceChangeByType[K],
          call?: CallOptions,
        ]
      }[FileWorkType],
    >(...[work, at, raw, options]: Args) {
      const change =
        work.type === 'anime' ? parsePlaybackOverrideChange(raw) : parseReadingOverrideChange(raw)
      options?.signal?.throwIfAborted()
      return complete(
        await call('updateHoldingPreferences', work, target(at), change),
      ) as UsageOverride<FilePreferencesByType[Args[0]['type']]>
    },
    async getEffective<T extends FileWorkType>(work: WorkRef<T>, file: string) {
      const override = await call('effectiveHoldingPreferences', work, file)
      return (override ?? { source: 'global', settings: defaults(work.type) }) as {
        source: 'global' | 'work' | 'file'
        settings: FilePreferencesByType[T]
      }
    },
  }
  async function inherited(work: FileWork, at: UsagePreferenceTarget) {
    if (at.type === 'file') {
      const parent = await preferences.get(work, { type: 'work' })
      if (parent) {
        const value = unpack(parent)
        if (value.enabled) {
          return value.settings
        }
      }
    }
    return defaults(work.type)
  }
  return { preferences, inherited }
}
