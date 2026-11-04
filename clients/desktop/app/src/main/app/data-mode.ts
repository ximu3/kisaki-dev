/** @fileoverview Determines whether a requested data-mode transition needs a restart. */

import type { DataLocationState } from '@kisaki3/desktop-contracts/app'

/** Pending restart is derived from actual current and selected modes; null means the next selection could not be read. */
export function dataModeRequiresRestart(state: DataLocationState): boolean | null {
  return state.portable.status === 'unavailable'
    ? null
    : state.portable.status === 'available' && state.current.mode !== state.portable.nextMode
}
