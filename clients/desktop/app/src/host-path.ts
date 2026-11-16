/** @fileoverview Parses fully qualified host paths, retaining their access spelling and registered volume. */

import { sep, toNamespacedPath } from 'node:path'

/** A complete access root, its namespace-independent volume name, and the offset of the first child. */
interface HostRoot {
  readonly root: string
  readonly volume: string
  readonly end: number
}

/** Recognizes a drive, a complete server/share pair or a rooted DOS device name. */
function windowsRoot(path: string): HostRoot | undefined {
  const namespace = /^\\\\[?.]\\/u.exec(path)?.[0] ?? ''
  const tail = path.slice(namespace.length)
  const drive = /^[A-Za-z]:\\/u.exec(tail)
  if (drive) {
    const volume = drive[0].toUpperCase()
    return { root: namespace + volume, volume, end: namespace.length + drive[0].length }
  }

  if (namespace && !/^UNC(?:\\|$)/iu.test(tail)) {
    const device = /^(?!\.{1,2}\\)[^\\:]+\\/u.exec(tail)
    if (!device) {
      return undefined
    }
    return {
      root: namespace + device[0],
      volume: '\\\\?\\' + device[0],
      end: namespace.length + device[0].length,
    }
  }

  const prefix = namespace ? namespace + 'UNC\\' : '\\\\'
  if (path.slice(0, prefix.length).toUpperCase() !== prefix) {
    return undefined
  }
  const share = /^([^\\]+)\\+([^\\]+)(?:\\|$)/u.exec(path.slice(prefix.length))
  if (!share || [share[1], share[2]].some((name) => name === '.' || name === '..')) {
    return undefined
  }
  const names = share[1] + '\\' + share[2] + '\\'
  return { root: prefix + names, volume: '\\\\' + names, end: prefix.length + share[0].length }
}

/** Reads the root of a host path with its separators already in native spelling. */
function hostRoot(path: string): HostRoot | undefined {
  if (path.includes('\0')) {
    return undefined
  }
  if (process.platform === 'win32') {
    return windowsRoot(path)
  }
  return path.startsWith('/') ? { root: '/', volume: '/', end: 1 } : undefined
}

/** Uses native separators before inspecting a Windows namespace or passing a path to the host. */
function hostSpelling(input: string): string {
  return process.platform === 'win32' ? input.replaceAll('/', '\\') : input
}

/** Keeps the directory separator required to open a volume root through its native namespace. */
function lookupRoot(root: string): string {
  const lookup = toNamespacedPath(root)
  return lookup.endsWith(sep) ? lookup : lookup + sep
}

/** Checks that the supplied root is independent of the working directory and current drive. */
export function isAbsoluteHostPath(input: string): boolean {
  return hostRoot(hostSpelling(input)) !== undefined
}

/** Supplies the native binding with Node's lookup spelling of a fully qualified path. */
export function nativeHostPath(input: string): string | undefined {
  const path = hostSpelling(input)
  const root = hostRoot(path)
  if (!root) {
    return undefined
  }
  const lookup = toNamespacedPath(root.root + path.slice(root.end))
  // Node can drop the last separator of an explicit root, which would open a device instead of its directory.
  return lookup + sep === lookupRoot(root.root) ? lookup + sep : lookup
}

/** Splits an absolute position into its access root, volume and verbatim entry names, retaining '..'. */
export function parseHostPath(input: string) {
  const path = hostSpelling(input)
  const root = hostRoot(path)
  if (!root) {
    throw new TypeError('Expected a fully qualified filesystem path without NUL')
  }
  const names = path
    .slice(root.end)
    .split(sep)
    .filter((name) => name !== '' && name !== '.')
  return {
    path: root.root + names.join(sep),
    root: root.root,
    lookupRoot: lookupRoot(root.root),
    volume: root.volume,
    names,
  }
}

/** A normalized access path and the volume and entry names that select its registered position. */
export type HostPath = ReturnType<typeof parseHostPath>
