/**
 * @fileoverview Interprets explicit desktop launch switches for development mode,
 * profiles, window selection and renderer location.
 */

import { app } from 'electron'
import { isAbsolute } from 'node:path'
import { developmentLaunchSwitches } from '@kisaki3/desktop-contracts/development'
import type { WindowKind } from '../../shared/window-controls'

/** Profile selection is independent of IPC so source automation can use an isolated profile. */
export interface ApplicationLaunch {
  development: boolean
  profile: string | undefined
  window: WindowKind
  rendererUrl: string | undefined
}

/** Read explicit launch inputs before Electron fixes paths; packaged development requires parent IPC. */
export function readApplicationLaunch(): ApplicationLaunch {
  const development = app.commandLine.hasSwitch(developmentLaunchSwitches.mode)
  const profile = app.commandLine.getSwitchValue(developmentLaunchSwitches.profile) || undefined
  if (development && (!process.connected || typeof process.send !== 'function')) {
    throw new Error('Managed development requires parent-child IPC')
  }
  if ((development || !app.isPackaged) && (!profile || !isAbsolute(profile))) {
    throw new Error('Development and source launches require an absolute profile path')
  }
  if (app.isPackaged && profile && !development) {
    throw new Error('Packaged profile overrides require managed development')
  }

  const window = app.isPackaged ? 'main' : app.commandLine.getSwitchValue('window') || 'main'
  if (!['main', 'reader', 'player', 'game-panel'].includes(window)) {
    throw new Error('Unknown development window')
  }

  return {
    development,
    profile,
    window: window as WindowKind,
    rendererUrl: app.isPackaged
      ? undefined
      : app.commandLine.getSwitchValue('renderer-url') || undefined,
  }
}
