/** @fileoverview Allocates saved activity duration to intersecting historical ranges. */

import type { ActivityTiming, InstantRange } from '@kisaki3/desktop-contracts/library'
import { parseActivityTiming } from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Allocate one saved effective duration proportionally to an intersecting [from, to) range without rounding. */
export function activityDurationInRange(activity: ActivityTiming, range: InstantRange): number {
  const value = parseActivityTiming(activity)
  const bounds = range
  if (
    !Number.isSafeInteger(bounds.from) ||
    !Number.isSafeInteger(bounds.to) ||
    Math.abs(bounds.from) > 8_640_000_000_000_000 ||
    Math.abs(bounds.to) > 8_640_000_000_000_000 ||
    bounds.from >= bounds.to
  ) {
    throw new DesktopError('InvalidInput', 'Invalid activity range')
  }

  const overlap = Math.max(
    0,
    Math.min(value.endedAt, bounds.to) - Math.max(value.startedAt, bounds.from),
  )
  return value.durationMs * (overlap / (value.endedAt - value.startedAt))
}
