import type { DesktopTarget } from '../lib/targets'

export const distributionKinds = ['zip', 'nsis', 'app', 'deb', 'rpm', 'appimage'] as const
export type DistributionKind = (typeof distributionKinds)[number]

/** Packaging metadata stored in the ASAR beside the runtime manifest. */
export interface DistributionManifest {
  kind: DistributionKind
  target: DesktopTarget
  testOnly: boolean
}
