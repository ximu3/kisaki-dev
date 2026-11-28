import type { FileWorkType } from '@kisaki3/desktop-contracts/library'
import { animeConditions } from '../anime/recognition'
import { comicConditions } from '../comic/recognition'
import { novelConditions } from '../novel/recognition'
import type { Condition } from './output'

export function builtin(type: FileWorkType, baseName: string, path?: string): Condition[] {
  switch (type) {
    case 'anime':
      return animeConditions(baseName)
    case 'comic':
      return comicConditions(baseName, path)
    case 'novel':
      return novelConditions(baseName, path)
  }
}
