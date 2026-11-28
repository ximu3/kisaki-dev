import * as s from '../../../../infrastructure/database/schema'

export const directory = { table: s.comicDirectories, owner: s.comicDirectories.comicId } as const

export const file = {
  table: s.comicFiles,
  owner: s.comicFiles.comicId,
  activity: s.comicReadingActivity,
  annotation: s.comicAnnotations,
  parts: ['comicVolume', 'comicChapter'],
} as const

export const recognitionProfiles = s.comicFileRecognitionProfiles
