import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseUserThemeCreate,
  parseUserThemeUpdate,
  type Theme,
  type UserThemeCreate,
  type UserThemeUpdate,
} from '@kisaki3/desktop-contracts/appearance'
import type { Storage } from '../../infrastructure/database'
import { themes } from '../../infrastructure/database/schema/application'
import { ready } from '../../infrastructure/database/codecs/json'
import { adoptNewFont, type NewFont } from '../fonts/storage'

function readTheme(db: Storage['db'], id: string): Theme<'user'> | null {
  const row = db.select().from(themes).where(eq(themes.id, id)).get()
  if (!row) {
    return null
  }
  if (row.light.status === 'invalid' || row.dark.status === 'invalid') {
    throw new DesktopError('DataIntegrityError', 'The saved theme is invalid')
  }
  return {
    ref: { type: 'user', id },
    ...parseUserThemeCreate({ name: row.name, light: row.light.value, dark: row.dark.value }),
  }
}

export function themeStorage({ db, transaction }: Storage) {
  return {
    getTheme: (id: string) => readTheme(db, id),
    listThemes: () =>
      db
        .select({ id: themes.id, name: themes.name })
        .from(themes)
        .orderBy(themes.name, themes.id)
        .all()
        .map(({ id, name }) => ({ ref: { type: 'user' as const, id }, name })),
    createTheme(input: UserThemeCreate, copiedFonts: readonly NewFont[] = []) {
      const { name, light, dark } = parseUserThemeCreate(input)
      const id = randomUUID()
      const now = Date.now()
      transaction((tx) => {
        for (const font of copiedFonts) {
          adoptNewFont(tx, font)
        }
        tx.insert(themes)
          .values({
            id,
            name,
            light: ready(light),
            dark: ready(dark),
            createdAt: now,
            updatedAt: now,
          })
          .run()
      })
      return { type: 'user' as const, id }
    },
    updateTheme(id: string, input: UserThemeUpdate) {
      const { changes, expected } = parseUserThemeUpdate(input)
      transaction((tx) => {
        const old = readTheme(tx, id)
        if (!old) {
          throw new DesktopError('NotFound', 'The theme does not exist')
        }
        const conflict =
          (expected?.name !== undefined && expected.name !== old.name) ||
          (['light', 'dark'] as const).some((branch) =>
            Object.entries(expected?.[branch] ?? {}).some(
              ([key, value]) =>
                !isDeepStrictEqual(value, old[branch][key as keyof typeof old.light]),
            ),
          )
        if (conflict) {
          throw new DesktopError('Conflict', 'A theme field you edited has changed')
        }
        tx.update(themes)
          .set({
            name: changes.name ?? old.name,
            light: ready({ ...old.light, ...changes.light }),
            dark: ready({ ...old.dark, ...changes.dark }),
            updatedAt: Date.now(),
          })
          .where(eq(themes.id, id))
          .run()
      }, 'immediate')
    },
    deleteTheme(id: string) {
      if (!db.delete(themes).where(eq(themes.id, id)).run().changes) {
        throw new DesktopError('NotFound', 'The theme does not exist')
      }
    },
  }
}
