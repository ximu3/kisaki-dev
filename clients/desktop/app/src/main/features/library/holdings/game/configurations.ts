import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { and, eq, max } from 'drizzle-orm'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type {
  GameLaunchConfigCreate,
  GameLaunchConfigUpdate,
  MoveInput,
  ReorderInput,
} from '@kisaki3/desktop-contracts/library'
import { gameLaunchConfigs as configs, entries } from '../../../../infrastructure/database/schema'
import { ready } from '../../../../infrastructure/database/codecs/json'
import type { Storage } from '../../../../infrastructure/database'
import { entryWhere, requireEntry } from '../../entries/tables'
import { orderedIds } from '../../ordering'
import { commit, expectFields, type LibraryWrite } from '../../transaction'

function changed(write: LibraryWrite, gameId: string, ids: string[]) {
  if (ids.length) {
    write.changes.push({
      type: 'holdingsChanged',
      work: { type: 'game', id: gameId },
      launchConfigIds: ids,
    })
  }
}
export function preferConfig(
  write: LibraryWrite,
  gameId: string,
  id: string | null,
  expected?: string | null,
) {
  requireEntry(write.db, { type: 'game', id: gameId })
  const previous =
    write.db
      .select({ id: configs.id })
      .from(configs)
      .where(and(eq(configs.gameId, gameId), eq(configs.isPreferred, true)))
      .get()?.id ?? null
  if (expected !== undefined && previous !== expected) {
    throw new DesktopError('Conflict', 'The preferred launch configuration has changed')
  }
  if (previous === id) {
    return
  }
  if (previous) {
    write.db
      .update(configs)
      .set({ isPreferred: false, updatedAt: write.now })
      .where(eq(configs.id, previous))
      .run()
  }
  if (
    id &&
    !write.db
      .update(configs)
      .set({ isPreferred: true, updatedAt: write.now })
      .where(and(eq(configs.gameId, gameId), eq(configs.id, id)))
      .run().changes
  ) {
    throw new DesktopError('InvalidReference', 'Choose a launch configuration of this game')
  }
  changed(
    write,
    gameId,
    [previous, id].filter((value): value is string => value !== null),
  )
}
export function addConfig(write: LibraryWrite, gameId: string, input: GameLaunchConfigCreate) {
  requireEntry(write.db, { type: 'game', id: gameId })
  const id = randomUUID(),
    last =
      write.db
        .select({ n: max(configs.sortOrder) })
        .from(configs)
        .where(eq(configs.gameId, gameId))
        .get()!.n ?? -1
  write.db
    .insert(configs)
    .values({
      id,
      gameId,
      name: input.name,
      note: input.note ?? null,
      definition: ready(input.definition),
      sortOrder: last + 1,
      createdAt: write.now,
      updatedAt: write.now,
    })
    .run()
  if (input.isPreferred) {
    preferConfig(write, gameId, id)
  } else {
    changed(write, gameId, [id])
  }
  return id
}
export function configStorage(storage: Storage) {
  return {
    listGameConfigs(gameId: string, sensitive: boolean) {
      return storage.transaction((db) => {
        if (
          !db
            .select({ id: entries.id })
            .from(entries)
            .where(
              and(
                entryWhere({ type: 'game', id: gameId }),
                sensitive ? undefined : eq(entries.isNsfw, false),
              ),
            )
            .get()
        ) {
          throw new DesktopError('NotFound', 'The game is unavailable')
        }
        return db
          .select()
          .from(configs)
          .where(eq(configs.gameId, gameId))
          .orderBy(configs.sortOrder, configs.id)
          .all()
      })
    },
    getGameConfig(gameId: string, id: string, sensitive: boolean) {
      return storage.transaction((db) =>
        db
          .select({ id: entries.id })
          .from(entries)
          .where(
            and(
              entryWhere({ type: 'game', id: gameId }),
              sensitive ? undefined : eq(entries.isNsfw, false),
            ),
          )
          .get()
          ? (db
              .select()
              .from(configs)
              .where(and(eq(configs.gameId, gameId), eq(configs.id, id)))
              .get() ?? null)
          : null,
      )
    },
    addGameConfig: (id: string, input: GameLaunchConfigCreate) =>
      commit(storage, (write) => addConfig(write, id, input)),
    editGameConfig(gameId: string, id: string, input: GameLaunchConfigUpdate) {
      return commit(storage, (write) => {
        const where = and(eq(configs.id, id), eq(configs.gameId, gameId))
        const before = write.db.select().from(configs).where(where).get()
        if (!before) {
          throw new DesktopError('NotFound', 'The launch configuration no longer exists')
        }
        const original = {
          ...before,
          definition: before.definition.status === 'ready' ? before.definition.value : undefined,
        }
        expectFields(original, input.expected)
        if (
          Object.entries(input.changes).every(([key, value]) =>
            isDeepStrictEqual(Reflect.get(original, key), value),
          )
        ) {
          return
        }
        const { definition, ...regular } = input.changes
        write.db
          .update(configs)
          .set({
            ...regular,
            ...(definition && { definition: ready(definition) }),
            updatedAt: write.now,
          })
          .where(where)
          .run()
        changed(write, gameId, [id])
      })
    },
    deleteGameConfig: (gameId: string, id: string) =>
      commit(storage, (write) => {
        if (
          !write.db
            .delete(configs)
            .where(and(eq(configs.gameId, gameId), eq(configs.id, id)))
            .run().changes
        ) {
          throw new DesktopError('NotFound', 'The launch configuration no longer exists')
        }
        changed(write, gameId, [id])
      }),
    preferGameConfig: (gameId: string, id: string | null, expected?: string | null) =>
      commit(storage, (write) => preferConfig(write, gameId, id, expected)),
    orderGameConfigs: (gameId: string, input: ReorderInput | MoveInput) =>
      commit(storage, (write) => {
        requireEntry(write.db, { type: 'game', id: gameId })
        const rows = write.db
          .select({ id: configs.id })
          .from(configs)
          .where(eq(configs.gameId, gameId))
          .orderBy(configs.sortOrder, configs.id)
          .all()
        const order = orderedIds(
          rows.map((row) => row.id),
          input,
        )
        if (order.every((id, i) => id === rows[i]!.id)) {
          return
        }
        order.forEach((id, sortOrder) =>
          write.db.update(configs).set({ sortOrder }).where(eq(configs.id, id)).run(),
        )
        changed(write, gameId, order)
      }),
  }
}
