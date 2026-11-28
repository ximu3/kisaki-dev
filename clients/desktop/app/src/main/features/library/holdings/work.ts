import { parseWorkRef } from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'

export function fileWork(input: unknown) {
  const ref = parseWorkRef(input)
  if (ref.type === 'game') {
    throw new DesktopError('InvalidInput', 'Choose an anime, comic or novel')
  }
  return { type: ref.type, id: ref.id }
}

export const callSignal = (options?: CallOptions) => options?.signal ?? new AbortController().signal
