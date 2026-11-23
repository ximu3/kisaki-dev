export type DesktopTarget =
  | 'windows-x64'
  | 'windows-arm64'
  | 'macos-x64'
  | 'macos-arm64'
  | 'linux-x64'
  | 'linux-arm64'

export const targetTriples: Record<DesktopTarget, string> = {
  'windows-x64': 'x86_64-pc-windows-msvc',
  'windows-arm64': 'aarch64-pc-windows-msvc',
  'macos-x64': 'x86_64-apple-darwin',
  'macos-arm64': 'aarch64-apple-darwin',
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
}

export function hostTarget(): DesktopTarget {
  const platforms: Partial<Record<NodeJS.Platform, string>> = {
    win32: 'windows',
    darwin: 'macos',
    linux: 'linux',
  }
  const platform = platforms[process.platform]
  return parseTarget(`${platform}-${process.arch}`)
}

export function parseTarget(value: string): DesktopTarget {
  if (!Object.hasOwn(targetTriples, value)) {
    throw new Error(`Unsupported desktop target: ${value}`)
  }

  return value as DesktopTarget
}
