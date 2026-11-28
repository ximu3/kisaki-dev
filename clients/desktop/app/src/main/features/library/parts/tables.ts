import { animeParts } from './anime/write'
import { comicParts } from './comic/write'
import { novelParts } from './novel'

export const parts = { ...animeParts, ...comicParts, ...novelParts } as const
