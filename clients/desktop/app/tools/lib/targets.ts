/**
 * @fileoverview Maps supported desktop targets to native toolchains and validates host or
 * explicit target selection.
 */

import type { DesktopTarget } from '../../src/shared/runtime-manifest'

/** The six supported toolchain targets, shared by resource, native and package workflows. */
export const targetTriples: Record<DesktopTarget, string> = {
  'windows-x64': 'x86_64-pc-windows-msvc',
  'windows-arm64': 'aarch64-pc-windows-msvc',
  'macos-x64': 'x86_64-apple-darwin',
  'macos-arm64': 'aarch64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
}

/** Return the target for this process, or throw for an unsupported platform or architecture. */
export function hostTarget(): DesktopTarget {
  const platforms: Partial<Record<NodeJS.Platform, string>> = {
    win32: 'windows',
    darwin: 'macos',
    linux: 'linux',
  }
  const platform = platforms[process.platform]
  return parseTarget(`${platform}-${process.arch}`)
}

/** Validate a user-supplied build target. */
export function parseTarget(value: string): DesktopTarget {
  if (!Object.hasOwn(targetTriples, value)) throw new Error(`Unsupported desktop target: ${value}`)
  return value as DesktopTarget
}
