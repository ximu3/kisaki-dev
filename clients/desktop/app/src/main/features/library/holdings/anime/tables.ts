import * as s from '../../../../infrastructure/database/schema'

export const directory = { table: s.animeDirectories, owner: s.animeDirectories.animeId } as const

export const file = {
  table: s.animeFiles,
  owner: s.animeFiles.animeId,
  activity: s.animeWatchActivity,
  annotation: s.animeAnnotations,
  parts: ['animeEpisode', 'animeExtra'],
} as const

export const recognitionProfiles = s.animeFileRecognitionProfiles
