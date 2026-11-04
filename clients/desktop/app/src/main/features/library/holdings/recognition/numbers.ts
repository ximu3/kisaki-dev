/** @fileoverview Expands and offsets explicit file-number labels within the caller work budget. */

import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Only the integer portion is shifted. Offset zero preserves original text, including decimal zeros and whitespace. */
export function applyFileNumberOffset(value: string, offset: number): string {
  if (!Number.isSafeInteger(offset)) {
    throw new DesktopError('InvalidInput', 'Invalid file number offset')
  }
  if (!value.trim()) {
    throw new DesktopError('InvalidInput', 'A file number output must not be blank')
  }
  if (offset === 0) {
    return value
  }

  const match = /^([0-9]+)(\.[0-9]+)?$/.exec(value.trim())
  if (!match) {
    throw new DesktopError(
      'InvalidInput',
      'Nonzero offsets require an integer or dotted numeric label',
    )
  }

  const shifted = BigInt(match[1]!) - BigInt(offset)
  if (shifted < 0n) {
    throw new DesktopError('InvalidInput', 'File number offset produced a negative value')
  }

  return `${shifted}${match[2] ?? ''}`
}

/** Expand an explicit integer interval only after its exact size fits the caller's actual remaining work budget. */
export function expandFileNumberRange(
  start: string,
  end: string,
  capacity: number,
): readonly string[] {
  if (!Number.isSafeInteger(capacity) || capacity < 0) {
    throw new DesktopError('InvalidInput', 'Invalid file range capacity')
  }
  if (!/^[0-9]+$/.test(start.trim()) || !/^[0-9]+$/.test(end.trim())) {
    throw new DesktopError('InvalidInput', 'File number ranges require integer endpoints')
  }

  const first = BigInt(start.trim())
  const last = BigInt(end.trim())
  if (last < first) {
    throw new DesktopError('InvalidInput', 'File number range is reversed')
  }
  if (last - first + 1n > BigInt(capacity)) {
    throw new DesktopError('ResourceLimit', 'File number range exceeds the available work budget')
  }

  const values: string[] = []
  for (let value = first; value <= last; value += 1n) {
    values.push(String(value))
  }

  return values
}
