/** @fileoverview Selects the highest eligible verified application release using SemVer order. */

import type { ApplicationRelease } from '@kisaki3/desktop-contracts/updates'
import {
  parseVersion,
  isPrereleaseVersion,
  compareVersions,
} from '@kisaki3/extension-distribution/compatibility'
import { parseApplicationRelease } from '@kisaki3/desktop-contracts/updates'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Select only from verified, target-compatible, non-draft candidates; discovery must supply all pages before selection. */
export function selectApplicationRelease(
  candidates: readonly ApplicationRelease[],
  currentVersion: string,
  allowPrerelease = false,
): ApplicationRelease | null {
  let current: string
  try {
    current = parseVersion(currentVersion)
  } catch (cause) {
    throw new DesktopError('InvalidInput', 'Invalid current application version', { cause })
  }
  let selected: ApplicationRelease | null = null
  for (const candidate of candidates) {
    const value = parseApplicationRelease(candidate)
    if (
      (!allowPrerelease && isPrereleaseVersion(value.version)) ||
      compareVersions(value.version, current) <= 0
    ) {
      continue
    }
    if (!selected || compareVersions(value.version, selected.version) > 0) {
      selected = value
    } else if (
      compareVersions(value.version, selected.version) === 0 &&
      value.tagName !== selected.tagName
    ) {
      throw new DesktopError('Conflict', 'Application release priorities collide')
    }
  }

  return selected
}
