/** @fileoverview Formats safe application environment details for support and clipboard output. */

import type { ApplicationEnvironment } from '@kisaki3/desktop-contracts/app'
import { parseApplicationEnvironment } from '@kisaki3/desktop-contracts/app'

/** Stable plain-text clipboard content; formatting neither reads the machine nor copies anything. */
export function formatApplicationEnvironment(input: ApplicationEnvironment): string {
  const value = parseApplicationEnvironment(input)
  return `Kisaki ${value.version}\n${value.operatingSystem.name} ${value.operatingSystem.version}\n${value.architecture}`
}
