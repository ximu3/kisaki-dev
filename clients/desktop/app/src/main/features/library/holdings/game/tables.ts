import * as s from '../../../../infrastructure/database/schema'

export const directory = { table: s.gameDirectories, owner: s.gameDirectories.gameId } as const
