/** @fileoverview Checks URL credential policy and preservation of the caller's prepared attachment handle. */

import { test, expect } from 'vite-plus/test'

import { parseFileInput, parsePreparedAttachment } from './resources'
import { DesktopError } from './errors'

test('resource inputs preserve legal headers and prepared handles while rejecting credential redirects and URL user information', () => {
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
    /** Records whether parsing invoked the fixture's release operation. */
    async dispose() {
      released = true
    },
  }

  expect(parsePreparedAttachment(prepared)).toBe(prepared)
  expect(released).toBe(false)
})
