import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { PartRef, FileNumberCondition } from '@kisaki3/desktop-contracts/library'
import { numberKey } from './naming'

export interface Candidate {
  ref: PartRef
  name: string | null
  number: string | null
  classification: string | null
  volumes: readonly { id: string; number: string | null }[]
}

export class LookupFailure extends Error {
  constructor(readonly reason: 'ambiguousTarget' | 'targetMissing') {
    super(
      reason === 'ambiguousTarget'
        ? 'Several parts match the identifier'
        : 'A matching part is missing',
    )
  }
}

export function unique(values: readonly Candidate[]) {
  if (!values.length) {
    throw new LookupFailure('targetMissing')
  }
  if (values.length !== 1) {
    throw new LookupFailure('ambiguousTarget')
  }
  return values[0]!
}

export function byNumber(
  list: readonly Candidate[],
  number: FileNumberCondition | undefined,
  label: (p: Candidate) => string | null | undefined,
) {
  if (!number) {
    return [unique(list)]
  }
  if (number.kind === 'single') {
    return [unique(list.filter((row) => numberKey(label(row)) === numberKey(number.value)))]
  }
  const lo = BigInt(number.start),
    hi = BigInt(number.end)
  if (lo > hi) {
    throw new DesktopError('InvalidInput', 'The range is reversed')
  }
  const found = new Map<bigint, Candidate>()
  for (const row of list) {
    const text = label(row)?.trim()
    if (!text || !/^\d+$/u.test(text)) {
      continue
    }
    const index = BigInt(text)
    if (index < lo || index > hi) {
      continue
    }
    if (found.has(index)) {
      throw new LookupFailure('ambiguousTarget')
    }
    found.set(index, row)
  }
  if (BigInt(found.size) !== hi - lo + 1n) {
    throw new LookupFailure('targetMissing')
  }
  return [...found].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, part]) => part)
}

export function namedParts(list: readonly Candidate[], kind: PartRef['type'], name?: string) {
  return list.filter(
    (item) => item.ref.type === kind && (name === undefined || item.name?.trim() === name.trim()),
  )
}
