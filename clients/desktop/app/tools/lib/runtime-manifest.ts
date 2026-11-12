/**
 * @fileoverview Defines desktop targets and build manifests used by engineering workflows
 * and artifact verification.
 */

/** An operating-system and native-architecture pair supported by the desktop application. */
export type DesktopTarget =
  'windows-x64' | 'windows-arm64' | 'macos-x64' | 'macos-arm64' | 'linux-x64' | 'linux-arm64'

/** Completed finite build, consumed by packaging and artifact verification. */
export interface DesktopBuild {
  schemaVersion: 1
  /** Opaque identifier shared by the programs compiled in this build. */
  buildId: string
  version: string
  target: DesktopTarget
  /** Runtime-relative paths mapped to the SHA-256 digest of each completed file. */
  files: Record<string, string>
  electronVersion: string
}
