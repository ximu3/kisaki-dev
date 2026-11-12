/** @fileoverview Owns the finite query field vocabulary and its applicable entry types. */

import { entryTypes, workTypes } from '../catalog'
import type { EntryType } from '../catalog'

const mediaTypes = ['anime', 'comic', 'novel'] as const

const bookTypes = ['comic', 'novel'] as const

const peopleTypes = ['character', 'person'] as const

/** Entry types that own each queryable, sortable or projectable fact. */
const fieldTypes = {
  name: entryTypes,
  originalName: entryTypes,
  sortName: entryTypes,
  effectiveSortName: entryTypes,
  aliases: entryTypes,
  description: entryTypes,
  externalLinks: entryTypes,
  primaryImageId: entryTypes,

  favorite: entryTypes,
  rating: entryTypes,
  isNsfw: entryTypes,
  hasNotes: entryTypes,
  hasPrimaryImage: entryTypes,
  tags: entryTypes,
  manualCollections: entryTypes,
  sources: entryTypes,

  addedDate: entryTypes,
  effectiveAddedDate: entryTypes,
  createdAt: entryTypes,
  updatedAt: entryTypes,

  status: workTypes,
  releaseDate: workTypes,
  originalLanguages: workTypes,
  hasBackdrop: workTypes,
  hasTitleLogo: workTypes,
  hasIcon: ['game'],

  additionalDurationMs: workTypes,
  totalDurationMs: workTypes,
  lastActiveAt: workTypes,
  completionCount: workTypes,
  firstCompletedDate: workTypes,
  lastCompletedDate: workTypes,
  completions: workTypes,

  releaseStatus: mediaTypes,
  releaseEndDate: mediaTypes,
  declaredDurationMs: ['anime'],
  declaredRegularEpisodeCount: ['anime'],
  declaredSpecialEpisodeCount: ['anime'],
  declaredPageCount: bookTypes,
  declaredVolumeCount: bookTypes,
  declaredChapterCount: ['comic'],

  registeredFileCount: mediaTypes,
  accessibleFileCount: mediaTypes,
  uncheckedFileCount: mediaTypes,
  parts: mediaTypes,
  partCounts: mediaTypes,

  birthDate: peopleTypes,
  birthMonthDay: peopleTypes,
  gender: peopleTypes,
  deathDate: ['person'],
  bloodType: ['character'],
  age: ['character'],
  height: ['character'],
  weight: ['character'],
  bust: ['character'],
  waist: ['character'],
  hips: ['character'],
  cupSize: ['character'],

  foundedDate: ['organization'],
  dissolvedDate: ['organization'],

  workCharacters: workTypes,
  workPersons: workTypes,
  workCharacterPersons: workTypes,
  workOrganizations: workTypes,
  relatedWorks: workTypes,

  characterWorks: ['character'],
  characterPersons: ['character'],

  personWorks: ['person'],
  personCharacters: ['person'],

  organizationWorks: ['organization'],
} satisfies Record<string, readonly EntryType[]>

export const entryFieldTypes: { readonly [K in keyof typeof fieldTypes]: readonly EntryType[] } =
  fieldTypes
