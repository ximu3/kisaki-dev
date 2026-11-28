import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseTextTemplate } from '@kisaki3/desktop-contracts/text-rules'
import type {
  FileWorkType,
  FileTargetByType,
  FileNumberOutput,
  FileConditionByType,
  FileNumberCondition,
  FileNumberValue,
} from '@kisaki3/desktop-contracts/library'

export type Condition = FileConditionByType[FileWorkType]
export interface NumberConversion {
  input: string
  offset: number
  value: string
}
type Expand = (
  captures: Readonly<Record<string, string | undefined>>,
  numbers?: NumberConversion[],
) => string

function template(value: string, names: readonly string[]): Expand {
  const parts = parseTextTemplate(value, names)
  return (captures) => {
    const output = parts
      .map((part) => {
        if (part.type === 'text') {
          return part.value
        }
        const value = captures[part.name]
        if (value === undefined) {
          throw new DesktopError('InvalidInput', 'A required capture did not participate')
        }
        return value
      })
      .join('')
      .trim()
    if (!output) {
      throw new DesktopError('InvalidInput', 'A file rule produced an empty identifier')
    }
    return output
  }
}
function label(spec: FileNumberValue, names: readonly string[]): Expand {
  const expand = template(spec.value, names)
  return (groups, numbers) => {
    const raw = expand(groups)
    if (spec.offset === 0) {
      numbers?.push({ input: raw, offset: 0, value: raw })
      return raw
    }
    const parts = /^(\d+)(\.\d+)?$/u.exec(raw)
    if (!parts) {
      throw new DesktopError('InvalidInput', 'Offsets require an unsigned decimal identifier')
    }
    const integer = BigInt(parts[1]!) - BigInt(spec.offset)
    if (integer < 0n) {
      throw new DesktopError('InvalidInput', 'The number offset produced a negative identifier')
    }
    const value = integer.toString() + (parts[2] ?? '')
    numbers?.push({ input: raw, offset: spec.offset, value })
    return value
  }
}
function numberOutput(
  spec: FileNumberOutput,
  names: readonly string[],
): (groups: Parameters<Expand>[0], numbers?: NumberConversion[]) => FileNumberCondition {
  if (spec.kind === 'single') {
    const expand = label(spec, names)
    return (groups, numbers) => ({ kind: 'single', value: expand(groups, numbers) })
  }
  const first = label({ value: spec.start, offset: spec.offset }, names),
    last = label({ value: spec.end, offset: spec.offset }, names)
  return (groups, numbers) => {
    const start = first(groups, numbers),
      end = last(groups, numbers)
    if (!/^\d+$/u.test(start) || !/^\d+$/u.test(end) || BigInt(start) > BigInt(end)) {
      throw new DesktopError('InvalidInput', 'A part range needs ordered integer endpoints')
    }
    return { kind: 'range', start, end }
  }
}
export function compileOutput(
  spec: FileTargetByType[FileWorkType],
  names: readonly string[],
): (groups: Parameters<Expand>[0], numbers?: NumberConversion[]) => Condition {
  const name = spec.name === undefined ? undefined : template(spec.name, names)
  if (spec.kind === 'extra') {
    return (groups) => ({
      kind: 'extra',
      name: name!(groups),
      ...('extraType' in spec && { extraType: spec.extraType }),
    })
  }
  const number = spec.number === undefined ? undefined : numberOutput(spec.number, names)
  const volume = spec.kind === 'chapter' ? spec.volume : undefined
  const volumeName = volume?.name === undefined ? undefined : template(volume.name, names)
  const volumeNumber = volume?.number === undefined ? undefined : label(volume.number, names)
  return (groups, numbers) => {
    const output = {
      kind: spec.kind,
      ...(name && { name: name(groups) }),
      ...(number && { number: number(groups, numbers) }),
    }
    if (spec.kind === 'episode' && 'episodeType' in spec) {
      Object.assign(output, { episodeType: spec.episodeType })
    }
    if (spec.kind === 'chapter') {
      if (spec.numberBasis) {
        Object.assign(output, { numberBasis: spec.numberBasis })
      }
      if (volume) {
        Object.assign(output, {
          volume: {
            ...(volumeName && { name: volumeName(groups) }),
            ...(volumeNumber && { number: volumeNumber(groups, numbers) }),
          },
        })
      }
    }
    return output as Condition
  }
}
