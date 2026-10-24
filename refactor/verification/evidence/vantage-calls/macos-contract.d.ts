// Design-only declaration specimen for the @ximu3/vantage/macos subpath.
import type { CallOptions } from './contract.js'

export type Permission = 'accessibility' | 'screenCapture'
export type PermissionStatus = 'granted' | 'notGranted'

export function queryPermission(
  permission: Permission,
  options?: CallOptions
): Promise<PermissionStatus>

export function requestPermission(
  permission: Permission,
  options?: CallOptions
): Promise<PermissionStatus>
