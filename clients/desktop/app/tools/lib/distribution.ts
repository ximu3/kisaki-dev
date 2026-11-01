/**
 * @fileoverview Defines packaged-carrier identities used by desktop deployment and
 * portable-data selection.
 */

import type { DesktopTarget } from './runtime-manifest'

/** Installer and movable-carrier identities recorded by the packager. */
export const distributionKinds = ['zip', 'nsis', 'app', 'deb', 'rpm', 'appimage'] as const
export type DistributionKind = (typeof distributionKinds)[number]

/** Packaging metadata stored in the ASAR beside the runtime manifest. */
export interface DistributionManifest {
  kind: DistributionKind
  target: DesktopTarget
  testOnly: boolean
}
