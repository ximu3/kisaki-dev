import type { DesktopTarget } from '../lib/targets'

export const distributionKinds = ['zip', 'nsis', 'app', 'deb', 'rpm', 'appimage'] as const
export type DistributionKind = (typeof distributionKinds)[number]

export interface DistributionManifest {
  kind: DistributionKind
  target: DesktopTarget
  testOnly: boolean
}
