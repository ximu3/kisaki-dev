/** @fileoverview Reads and copies the safe environment summary used by the About dialog. */

import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import { clipboard } from 'electron'
import manifest from '../../../package.json' with { type: 'json' }
import { parseApplicationEnvironment } from '@kisaki3/desktop-contracts/app'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Reports the running process architecture, application version and actual operating system. */
export function environment(options?: CallOptions) {
  options?.signal?.throwIfAborted()
  const systems: Partial<Record<NodeJS.Platform, string>> = {
    win32: 'Windows',
    darwin: 'macOS',
    linux: 'Linux',
  }
  return parseApplicationEnvironment({
    version: manifest.version,
    architecture: process.arch,
    operatingSystem: { name: systems[process.platform], version: process.getSystemVersion() },
  })
}

/** Copies only the requested public environment summary and confirms the clipboard accepted it. */
export async function copyEnvironment(options?: CallOptions) {
  const info = environment(options)
  const text =
    'Kisaki ' +
    info.version +
    '\n' +
    info.operatingSystem.name +
    ' ' +
    info.operatingSystem.version +
    ' (' +
    info.architecture +
    ')'
  await clipboard.writeText(text)
  if ((await clipboard.readText()) !== text) {
    throw new DesktopError('WriteFailed', 'The environment information could not be copied')
  }
}
