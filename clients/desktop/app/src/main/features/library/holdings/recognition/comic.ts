import { bookMarkers } from './book-markers'
import { byNumber, namedParts, unique, type Candidate } from './lookup'
import { numberKey, numeric, sequence, stem } from './naming'
import type { Condition } from './rules/output'

export function comicConditions(baseName: string, path?: string): Condition[] {
  const content = stem(baseName, true)
  const source = new RegExp('(?:^|[ ._-])c(' + numeric + ')\\s*\\(v\\d+\\)$', 'iu').exec(content)
  if (source) {
    return [{ kind: 'chapter', numberBasis: 'work', number: { kind: 'single', value: source[1]! } }]
  }
  const { chapter, volume, folder } = bookMarkers(content, path)
  if (chapter) {
    const scope = volume ?? folder
    return sequence(chapter).map((number) => ({
      kind: 'chapter',
      numberBasis: scope ? 'volume' : 'work',
      number,
      ...(scope && { volume: { number: scope } }),
    }))
  }
  return volume ? sequence(volume).map((number) => ({ kind: 'volume', number })) : []
}

export function matchComic(
  condition: Extract<Condition, { kind: 'volume' | 'chapter' }>,
  list: readonly Candidate[],
) {
  if (condition.kind === 'volume') {
    return byNumber(
      namedParts(list, 'comicVolume', condition.name),
      condition.number,
      (row) => row.number,
    )
  }
  const chapters = namedParts(list, 'comicChapter', condition.name)
  const scope = condition.volume
  if (!scope) {
    return byNumber(chapters, condition.number, (row) => row.number)
  }
  const volume = unique(
    namedParts(list, 'comicVolume', scope.name).filter(
      (row) => !scope.number || numberKey(scope.number) === numberKey(row.number),
    ),
  )
  const membership = (row: Candidate) => row.volumes.find((member) => member.id === volume.ref.id)
  return byNumber(
    chapters.filter((row) => membership(row)),
    condition.number,
    (row) => (condition.numberBasis === 'volume' ? membership(row)?.number : row.number),
  )
}
