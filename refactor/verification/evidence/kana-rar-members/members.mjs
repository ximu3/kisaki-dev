// Resolve archive references without creating filesystem links or changing the requested identity.
export class MemberFailure extends Error {
  constructor(reason) {
    super('Archive member cannot be resolved')
    this.reason = reason
  }
}
const fail = (reason) => {
  throw new MemberFailure(reason)
}
const split = (path, windows = false) => {
  if (typeof path !== 'string' || !path || path.includes('\0')) fail('invalidPath')
  const value = windows ? path.replaceAll('\\', '/') : path
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) fail('outsideArchive')
  return value.split('/')
}
const canonical = (name) => {
  const parts = []
  for (const part of split(name)) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (!parts.length) fail('outsideArchive')
      parts.pop()
    } else parts.push(part)
  }
  if (!parts.length) fail('invalidPath')
  return parts.join('/')
}

export function createMemberIndex(entries) {
  const exact = new Map()
  const directories = new Set([''])
  for (const entry of entries) {
    const path = canonical(entry.name)
    const matches = exact.get(path) || []
    matches.push(entry)
    exact.set(path, matches)
    const parts = path.split('/')
    for (let count = 1; count < parts.length; count++)
      directories.add(parts.slice(0, count).join('/'))
    if (entry.directory && !entry.redirection) directories.add(path)
  }
  const lookup = (path) => {
    const matches = exact.get(path)
    if (matches?.length > 1) fail('ambiguousTarget')
    if (matches?.length) return matches[0]
    if (directories.has(path)) return { name: path, directory: true, redirection: 0 }
    fail('missingTarget')
  }
  return {
    resolve(requested) {
      let expansions = 0
      const walk = (parts, base, active) => {
        let resolved = [...base]
        for (let index = 0; index < parts.length; index++) {
          const part = parts[index]
          if (!part || part === '.') continue
          if (part === '..') {
            if (!resolved.length) fail('outsideArchive')
            resolved.pop()
            continue
          }
          const path = [...resolved, part].join('/')
          const entry = lookup(path)
          let target = entry
          if (entry.redirection) {
            if (entry.redirection < 1 || entry.redirection > 5) fail('unsupportedReference')
            if (active.has(path)) fail('referenceCycle')
            if (++expansions > 64) fail('referenceLimit')
            const rooted = entry.redirection === 4 || entry.redirection === 5
            const names = split(
              entry.target,
              entry.redirection === 2 || entry.redirection === 3 || (rooted && entry.windowsNames)
            )
            const result = walk(names, rooted ? [] : resolved, new Set([...active, path]))
            target = result.target
            const expectedDirectory = entry.targetInData
              ? null
              : !!(entry.directoryTarget || entry.directory)
            if (expectedDirectory !== null && expectedDirectory !== !!target.directory)
              fail('targetKindMismatch')
            resolved = result.parts
          } else resolved.push(part)
          if (index < parts.length - 1 && !target.directory) fail('notDirectory')
        }
        return { parts: resolved, target: lookup(resolved.join('/')) }
      }
      return { memberPath: requested, target: walk(split(requested), [], new Set()).target }
    }
  }
}
