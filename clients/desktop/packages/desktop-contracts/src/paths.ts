import { fromParser, parseValue, nonemptyText } from './validation'
import { DesktopError } from './errors'
import * as v from 'valibot'

export type PathFilter =
  | { readonly kind: 'path'; readonly path: string }
  | { readonly kind: 'glob'; readonly pattern: string; readonly ignoreCase: boolean }

function hasWindowsRoot(value: string): boolean {
  let path = value.replaceAll('/', '\\')
  if (path.startsWith('\\\\?\\') || path.startsWith('\\\\.\\')) {
    const device = path.slice(4)
    if (/^UNC(?:\\|$)/iu.test(device)) {
      path = '\\\\' + device.slice(4)
    } else if (/^[A-Za-z]:/u.test(device)) {
      path = device
    } else {
      return /^(?!\.{1,2}\\)[^\\:]+\\/u.test(device)
    }
  }
  return (
    /^[A-Za-z]:\\/u.test(path) || /^\\\\(?!\.{1,2}\\)[^\\]+\\+(?!\.{1,2}(?:\\|$))[^\\]+/u.test(path)
  )
}

export function parseAbsolutePath(input: unknown): string {
  const value = parseValue(nonemptyText, input, 'Invalid absolute path')
  if (value.includes('\0') || !(value.startsWith('/') || hasWindowsRoot(value))) {
    throw new DesktopError('InvalidInput', 'An explicit absolute filesystem path is required')
  }

  return value
}

export function parseRelativePath(input: unknown): string {
  const value = parseValue(nonemptyText, input, 'Invalid relative path')
  if (value === '.') {
    return value
  }
  if (
    /[\\\0]/.test(value) ||
    /^[A-Za-z]:/.test(value) ||
    value.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new DesktopError('InvalidInput', 'Expected a root-relative slash-separated path')
  }

  return value
}

export function parsePathFilter(input: unknown): PathFilter {
  const value = parseValue(
    v.variant('kind', [
      v.strictObject({
        kind: v.literal('path'),
        path: fromParser(parseRelativePath),
      }),
      v.strictObject({
        kind: v.literal('glob'),
        pattern: fromParser(parseRelativePath),
        ignoreCase: v.boolean(),
      }),
    ]),
    input,
    'Invalid path filter',
  )
  if (
    value.kind === 'glob' &&
    value.pattern.split('/').some((part) => part.includes('**') && part !== '**')
  ) {
    throw new DesktopError(
      'InvalidInput',
      'A recursive glob wildcard must occupy a complete path segment',
    )
  }

  return value
}
