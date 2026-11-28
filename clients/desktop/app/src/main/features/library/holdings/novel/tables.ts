import * as s from '../../../../infrastructure/database/schema'

export const directory = { table: s.novelDirectories, owner: s.novelDirectories.novelId } as const

export const file = {
  table: s.novelFiles,
  owner: s.novelFiles.novelId,
  activity: s.novelReadingActivity,
  annotation: s.novelAnnotations,
  parts: ['novelVolume'],
} as const

export const recognitionProfiles = s.novelFileRecognitionProfiles
