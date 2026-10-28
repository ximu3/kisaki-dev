/**
 * @fileoverview Defines desktop targets and build manifests shared by runtime loading,
 * tooling and artifact consumers.
 */

/** An operating-system and native-architecture pair supported by the desktop application. */
export type DesktopTarget =
  'windows-x64' | 'windows-arm64' | 'macos-x64' | 'macos-arm64' | 'linux-x64' | 'linux-arm64'

/** Metadata shared by development and finite runtimes, written beside their program entries. */
export interface RuntimeManifest {
  schemaVersion: 1
  /** Opaque Turbo build-task input identity; files separately records the actual runtime bytes. */
  buildId: string
  version: string
  target: DesktopTarget
  /** Runtime-relative paths mapped to the SHA-256 digest of each completed file. */
  files: Record<string, string>
}

/** A finite desktop build with the version information needed by packaging and consumers. */
export interface DesktopBuild extends RuntimeManifest {
  electronVersion: string
}
