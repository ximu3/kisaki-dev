import { randomUUID } from 'node:crypto'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseNativeViewTarget, type NativeViewTarget } from '@kisaki3/desktop-contracts/ui'

export function notificationTarget(appId: string, target: NativeViewTarget) {
  const data = Buffer.from(JSON.stringify(target)).toString('base64url')
  return `${appId}/notification/${randomUUID()}/${data}`
}

export function readNotificationTarget(appId: string, input: unknown): NativeViewTarget | null {
  const prefix = appId + '/notification/'
  if (typeof input !== 'string' || !input.startsWith(prefix)) {
    return null
  }
  const parts = input.slice(prefix.length).split('/')
  try {
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error('Missing notification identifier or destination')
    }
    return parseNativeViewTarget(JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')))
  } catch (cause) {
    throw new DesktopError('InvalidInput', 'The notification destination could not be read', {
      cause,
    })
  }
}
