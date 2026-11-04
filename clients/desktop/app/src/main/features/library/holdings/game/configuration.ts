/** @fileoverview Supplies game-launch defaults and checks executable launch prerequisites. */

import type { GameLaunchDefinition } from '@kisaki3/desktop-contracts/library'
import { parseGameLaunchDefinition } from '@kisaki3/desktop-contracts/library'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Determine only whether required launch/monitor inputs are filled, not whether files, permissions or processes are usable. */
export function hasGameLaunchInputs(definition: GameLaunchDefinition): boolean {
  const target = definition.launch
  let hasLaunch: boolean
  switch (target.type) {
    case 'file':
      hasLaunch = target.path !== null
      break
    case 'url':
      hasLaunch = target.url !== null
      break
    case 'command':
      hasLaunch = target.command !== null
      break
  }

  const hasMonitor =
    definition.monitor.type === 'process'
      ? definition.monitor.name !== null
      : definition.monitor.path !== null
  return hasLaunch && hasMonitor
}

/** Provide a blank user-created file configuration; directory registration does not invoke this factory or create a row. */
export function getGameLaunchDefaults(): GameLaunchDefinition {
  return {
    launch: { type: 'file', path: null },
    monitor: { type: 'directory', path: null },
    timing: 'foreground',

    savePath: null,
    autoBackupEnabled: false,
    backupRetentionCount: 5,
  }
}

/** Reject a known incomplete configuration before actual launch preparation; runtime usability still needs host checks. */
export function requireGameLaunchInputs(input: unknown): GameLaunchDefinition {
  const definition = parseGameLaunchDefinition(input)
  if (!hasGameLaunchInputs(definition)) {
    throw new DesktopError('InvalidInput', 'Game launch and monitoring targets must be configured')
  }

  return definition
}
