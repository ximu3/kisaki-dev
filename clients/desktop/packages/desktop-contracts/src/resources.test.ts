/** @fileoverview Verifies acquired resource holds and credential-bearing file request boundaries. */

import { test, expect } from 'vitest'

import { parseFileInput, parsePreparedAttachment } from './resources'
import { DesktopError } from './errors'

test('resource inputs preserve legal headers and real holds while rejecting credential redirects and URL user information', async () => {
  const headers = Object.fromEntries([
    ['constructor', 'value'],
    ['__proto__', 'retained'],
  ])

  expect(parseFileInput({ type: 'url', url: 'https://example.test/file', headers })).toEqual({
    type: 'url',
    url: 'https://example.test/file',
    headers,
  })

  expect(() =>
    parseFileInput({
      type: 'url',
      url: 'https://example.test/file',
      headers: { aUtHoRiZaTiOn: 'Bearer synthetic' },
    }),
  ).toThrow(DesktopError)

  expect(
    parseFileInput({
      type: 'url',
      url: 'https://example.test/file',
      headers: { Cookie: 'synthetic=1' },
      redirect: 'error',
    }),
  ).toMatchObject({ redirect: 'error' })

  expect(() =>
    parseFileInput({ type: 'url', url: 'https://user:password@example.test/file' }),
  ).toThrow(DesktopError)

  let released = false
  const prepared = {
    attachmentId: 'prepared',
    resource: { id: 'resource' },
    async dispose() {
      released = true
    },
  }

  expect(parsePreparedAttachment(prepared)).toBe(prepared)
  expect(released).toBe(false)

  await prepared.dispose()

  expect(released).toBe(true)
})
