import { isWorkType, type EntryType, type EntryDetails } from '@kisaki3/desktop-contracts/library'
import { countFields, detailDates, measurements } from '../fields'

export type EditField =
  | 'name'
  | 'originalName'
  | 'description'
  | 'information'
  | 'rating'
  | 'additionalTime'
  | 'additionalCount'
  | 'images'
  | 'links'
  | 'identities'
export type EntryEdit =
  | { field: 'create'; type: EntryType }
  | { field: EditField; entry: EntryDetails; description: string | null }

export function information(entry: EntryDetails) {
  const fields: Record<string, unknown> = {
    sortName: entry.sortName,
    aliases: entry.aliases,
    addedDate: entry.addedDate,
  }
  for (const key of [...detailDates(entry.type), ...countFields(entry.type)]) {
    fields[key] = Reflect.get(entry, key)
  }
  if (isWorkType(entry.type) && 'originalLanguages' in entry) {
    fields.originalLanguages = entry.originalLanguages
  }
  if ('releaseStatus' in entry) {
    fields.releaseStatus = entry.releaseStatus
  }
  if ('gender' in entry) {
    fields.gender = entry.gender
  }
  if (entry.type === 'character') {
    fields.bloodType = entry.bloodType
    for (const key of measurements) {
      fields[key] = entry[key]
    }
    fields.cupSize = entry.cupSize
  }
  return fields
}
