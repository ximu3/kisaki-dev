import { dequal } from 'dequal/lite'
import type { UserThemeCreate, UserThemeUpdate } from '@kisaki3/desktop-contracts/appearance'

export interface ThemeEdit {
  id: string | null
  definition: UserThemeCreate
}

export function themeUpdate(value: UserThemeCreate, original: UserThemeCreate): UserThemeUpdate {
  function difference<T extends object>(next: T, old: T) {
    const keys = Object.keys(next) as (keyof T)[]
    const changes: Partial<T> = {}
    const expected: Partial<T> = {}
    for (const key of keys) {
      if (dequal(next[key], old[key])) {
        continue
      }
      changes[key] = next[key]
      expected[key] = old[key]
    }
    return { changes, expected }
  }

  const light = difference(value.light, original.light)
  const dark = difference(value.dark, original.dark)
  return {
    changes: {
      ...(value.name !== original.name && { name: value.name }),
      ...(Object.keys(light.changes).length && { light: light.changes }),
      ...(Object.keys(dark.changes).length && { dark: dark.changes }),
    },
    expected: {
      ...(value.name !== original.name && { name: original.name }),
      ...(Object.keys(light.expected).length && { light: light.expected }),
      ...(Object.keys(dark.expected).length && { dark: dark.expected }),
    },
  }
}
