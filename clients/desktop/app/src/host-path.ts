import { sep, toNamespacedPath } from 'node:path'

interface HostRoot {
  readonly root: string
  readonly volume: string
  readonly childOffset: number
}

function windowsRoot(path: string): HostRoot | undefined {
  const namespace = /^\\\\[?.]\\/u.exec(path)?.[0] ?? ''
  const tail = path.slice(namespace.length)
  const drive = /^[A-Za-z]:\\/u.exec(tail)
  if (drive) {
    const volume = drive[0].toUpperCase()
    return { root: namespace + volume, volume, childOffset: namespace.length + drive[0].length }
  }

  if (namespace && !/^UNC(?:\\|$)/iu.test(tail)) {
    const device = /^(?!\.{1,2}\\)[^\\:]+\\/u.exec(tail)
    if (!device) {
      return undefined
    }
    return {
      root: namespace + device[0],
      volume: '\\\\?\\' + device[0],
      childOffset: namespace.length + device[0].length,
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
  const shareRoot = share[1] + '\\' + share[2] + '\\'
  return {
    root: prefix + shareRoot,
    volume: '\\\\' + shareRoot,
    childOffset: prefix.length + share[0].length,
  }
}

function hostRoot(path: string): HostRoot | undefined {
  if (path.includes('\0')) {
    return undefined
  }
  if (process.platform === 'win32') {
    return windowsRoot(path)
  }
  return path.startsWith('/') ? { root: '/', volume: '/', childOffset: 1 } : undefined
}

function hostSpelling(input: string): string {
  return process.platform === 'win32' ? input.replaceAll('/', '\\') : input
}

function lookupRoot(root: string): string {
  const lookup = toNamespacedPath(root)
  return lookup.endsWith(sep) ? lookup : lookup + sep
}

export function isAbsoluteHostPath(input: string): boolean {
  return hostRoot(hostSpelling(input)) !== undefined
}

export function nativeHostPath(input: string): string | undefined {
  const path = hostSpelling(input)
  const root = hostRoot(path)
  if (!root) {
    return undefined
  }

  const lookup = toNamespacedPath(root.root + path.slice(root.childOffset))
  // Node can drop the last separator of an explicit root, which would open a device instead of its directory.
  return lookup + sep === lookupRoot(root.root) ? lookup + sep : lookup
}

export function parseHostPath(input: string) {
  const path = hostSpelling(input)
  const root = hostRoot(path)
  if (!root) {
    throw new TypeError('Expected a fully qualified filesystem path without NUL')
  }
  const names = path
    .slice(root.childOffset)
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

export type HostPath = ReturnType<typeof parseHostPath>
