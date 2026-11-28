import type { Condition } from '../recognition/output'
import { sequence, stem } from '../recognition/naming'
import { byNumber, namedParts, type Candidate } from '../recognition/lookup'
import { bookMarkers } from '../reading/markers'

export function novelConditions(baseName: string, path?: string): Condition[] {
  const { chapter, volume } = bookMarkers(stem(baseName, true), path)
  return volume && !chapter ? sequence(volume).map((number) => ({ kind: 'volume', number })) : []
}

export function matchNovel(
  condition: Extract<Condition, { kind: 'volume' }>,
  list: readonly Candidate[],
) {
  return byNumber(
    namedParts(list, 'novelVolume', condition.name),
    condition.number,
    (row) => row.number,
  )
}
