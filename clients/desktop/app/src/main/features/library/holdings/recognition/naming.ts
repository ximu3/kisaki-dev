import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { FileNumberCondition } from '@kisaki3/desktop-contracts/library'

export function numberKey(value: string | null | undefined) {
  const text = value?.trim()
  return text && /^[0-9]+$/u.test(text) ? text.replace(/^0+(?=\d)/u, '') : text
}

export const numeric = '[0-9]+(?:\\.[0-9]+)?'
export const series = numeric + '(?:(?:[-–~〜～+])' + numeric + ')*'
const suffix =
  /^(?:[0-9a-f]{8}|(?:ma)?(?:8|10|12)(?:p|bit)|(?:360|480|576|720|1080|1440|2160)[pi]|[0-9]{3,4}x[0-9]{3,4}|uhd|4k|hdr(?:10)?|bluray|bd(?:rip)?|web(?:[ .-]?dl|rip)?|tv|dvd|hevc|avc|av1|x26[45]|h[ .]?26[45]|aac|flac|opus|ac3|dts)$/iu
export function conflict(): never {
  throw new DesktopError('Conflict', 'The filename contains conflicting part identifiers')
}

export function sequence(value: string): FileNumberCondition[] {
  if (value.includes('+')) {
    const labels = value.split('+')
    if (labels.some((item) => /[-–~〜～]/u.test(item))) {
      conflict()
    }
    return labels.map((label) => ({ kind: 'single', value: label }))
  }
  const ends = value.split(/[-–~〜～]/u)
  if (ends.length === 1) {
    return [{ kind: 'single', value }]
  }
  if (
    ends.length !== 2 ||
    ends.some((label) => !/^\d+$/u.test(label)) ||
    BigInt(ends[0]!) > BigInt(ends[1]!)
  ) {
    conflict()
  }
  return [{ kind: 'range', start: ends[0]!, end: ends[1]! }]
}

export function stem(input: string, book: boolean) {
  let value = input.trim().replace(/^\[[^\]]+\]\s+(?=\S)/u, '')
  while (true) {
    const tail = /\s*\[([^\]]+)\]\s*$/u.exec(value)
    if (!tail) {
      break
    }
    const tokens = tail[1]!.split(/[\s_+]+/u)
    if (!tokens.every((token) => suffix.test(token)) && !(book && !/\d/u.test(tail[1]!))) {
      break
    }
    value = value.slice(0, tail.index).trimEnd()
  }
  return value
}
