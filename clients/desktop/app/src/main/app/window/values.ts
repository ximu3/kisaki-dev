import { DesktopError } from '@kisaki3/desktop-contracts/errors'

export function textArgument(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new DesktopError('InvalidInput', 'Expected a nonempty text value')
  }
  return value
}

export function toggle(value: unknown) {
  if (typeof value !== 'boolean') {
    throw new DesktopError('InvalidInput', 'Expected an enabled or disabled setting')
  }
  return value
}
