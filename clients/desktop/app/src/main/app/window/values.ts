/** @fileoverview Validates scalar arguments received by native window management methods. */

import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Reads one nonempty string passed across the native document boundary. */
export function textArgument(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new DesktopError('InvalidInput', 'Expected a nonempty text value')
  }
  return value
}

/** Checks a system toggle before applying it to an external registration. */
export function toggle(value: unknown) {
  if (typeof value !== 'boolean') {
    throw new DesktopError('InvalidInput', 'Expected an enabled or disabled setting')
  }
  return value
}
