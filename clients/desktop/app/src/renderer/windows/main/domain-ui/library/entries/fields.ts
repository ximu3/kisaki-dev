import type { PartialDate } from '@kisaki3/desktop-contracts/date'
import type { CharacterMeasure, EntryType } from '@kisaki3/desktop-contracts/library'

export type CalendarKey =
  | 'birthDate'
  | 'deathDate'
  | 'releaseDate'
  | 'releaseEndDate'
  | 'foundedDate'
  | 'dissolvedDate'
  | 'addedDate'
export type NumberKey =
  | 'declaredPageCount'
  | 'declaredChapterCount'
  | 'declaredDurationMs'
  | 'declaredRegularEpisodeCount'
  | 'declaredSpecialEpisodeCount'
  | 'declaredVolumeCount'
export type MeasureKey = 'age' | 'height' | 'weight' | 'bust' | 'waist' | 'hips'
export const measurements: readonly MeasureKey[] = [
  'age',
  'height',
  'weight',
  'bust',
  'waist',
  'hips',
]

export function detailDates(type: EntryType): readonly CalendarKey[] {
  if (type === 'organization') {
    return ['foundedDate', 'dissolvedDate', 'addedDate']
  }
  if (type === 'person') {
    return ['birthDate', 'deathDate', 'addedDate']
  }
  if (type === 'character') {
    return ['birthDate', 'addedDate']
  }
  if (type === 'game') {
    return ['releaseDate', 'addedDate']
  }
  return ['releaseDate', 'releaseEndDate', 'addedDate']
}
export function countFields(type: EntryType): readonly NumberKey[] {
  switch (type) {
    case 'anime':
      return ['declaredRegularEpisodeCount', 'declaredSpecialEpisodeCount', 'declaredDurationMs']
    case 'novel':
      return ['declaredVolumeCount', 'declaredPageCount']
    case 'comic':
      return ['declaredVolumeCount', 'declaredChapterCount', 'declaredPageCount']
    case 'game':
    case 'character':
    case 'organization':
    case 'person':
      return []
  }
}

export function calendarText(value: PartialDate | null, locale: string) {
  if (!value) {
    return '—'
  }
  if (value.year !== undefined && value.month !== undefined && value.day !== undefined) {
    const day = new Date(0)
    day.setFullYear(value.year, value.month - 1, value.day)
    return new Intl.DateTimeFormat(locale).format(day)
  }
  return [value.year, value.month, value.day].map((n) => n ?? '—').join(' / ')
}
export function measureText(value: CharacterMeasure | null) {
  return value ? String(value.value) : '—'
}
