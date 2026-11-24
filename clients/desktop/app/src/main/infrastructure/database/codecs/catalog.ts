import {
  parseAliases,
  parseExternalLinks,
  parseLanguages,
  parseCharacterMeasure,
} from '@kisaki3/desktop-contracts/library'
import {
  parsePartialDate,
  parseCalendarDate,
  type PartialDate,
  type CalendarDate,
} from '@kisaki3/desktop-contracts/date'
import {
  jsonColumn,
  readWithFallback,
  readJsonText,
  isInvalidValue,
  type ValueParser,
} from './json'

function readList<T>(source: unknown, parse: ValueParser<readonly T[]>): readonly T[] {
  let value: unknown
  try {
    value = readJsonText(source)
  } catch (error) {
    if (!isInvalidValue(error)) {
      throw error
    }
    return []
  }
  if (!Array.isArray(value)) {
    return []
  }

  const result: T[] = []
  for (const item of value) {
    try {
      result.push(...parse([item]))
    } catch (error) {
      if (!isInvalidValue(error)) {
        throw error
      }
    }
  }
  return result
}

export const aliases = jsonColumn(parseAliases, (source) => readList(source, parseAliases))

export const externalLinks = jsonColumn(parseExternalLinks, (source) =>
  readList(source, parseExternalLinks),
)

export const languages = jsonColumn(parseLanguages, (source) => [
  ...new Set(readList(source, parseLanguages)),
])

export const partialDate = jsonColumn<PartialDate | null>(
  (value) => (value === null ? null : parsePartialDate(value)),
  (source) => readWithFallback(source, parsePartialDate, () => null),
)

export const calendarDate = jsonColumn<CalendarDate | null>(
  (value) => (value === null ? null : parseCalendarDate(value)),
  (source) => readWithFallback(source, parseCalendarDate, () => null),
)

export const characterMeasure = jsonColumn(
  (value) => (value === null ? null : parseCharacterMeasure(value)),
  (source) => readWithFallback(source, parseCharacterMeasure, () => null),
)
