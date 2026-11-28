import { animeParts } from './anime/parts'
import { comicParts } from './comic/parts'
import { novelParts } from './novel'

export const parts = { ...animeParts, ...comicParts, ...novelParts } as const
