/** @fileoverview Checks application release identity and complete prepared-file metadata. */

import { expect, test } from 'vite-plus/test'
import {
  parseApplicationRelease,
  parsePreparedApplicationUpdate,
  getDesktopReleaseVersion,
} from './updates'
import { DesktopError } from './errors'

test('release values retain the desktop family and valid prepared digests', () => {
  const release = {
    version: '1.2.0',
    tagName: 'desktop@1.2.0',
    publishedAt: 100,
    releaseUrl: 'https://example.test/release',
    delivery: { type: 'manual', downloadUrl: 'https://example.test/download.zip' },
  }

  expect(parseApplicationRelease(release)).toEqual(release)

  expect(getDesktopReleaseVersion('desktop@1.2.0-rc.1')).toBe('1.2.0-rc.1')
  expect(getDesktopReleaseVersion('desktop@1.2.0+build.7')).toBeNull()
  expect(() =>
    parseApplicationRelease({
      ...release,
      version: '1.2.0+build.7',
      tagName: 'desktop@1.2.0+build.7',
    }),
  ).toThrow(DesktopError)

  expect(() => parseApplicationRelease({ ...release, tagName: 'extension-sdk@1.2.0' })).toThrow(
    DesktopError,
  )

  const file = {
    url: 'https://example.test/update.zip',
    size: 10,
    sha512: Buffer.alloc(64).toString('base64'),
  }

  expect(
    parsePreparedApplicationUpdate({ version: '1.2.0', tagName: 'desktop@1.2.0', files: [file] })
      .files,
  ).toEqual([file])

  expect(() =>
    parsePreparedApplicationUpdate({
      version: '1.2.0',
      tagName: 'desktop@1.2.0',
      files: [{ ...file, sha512: 'a'.repeat(64) }],
    }),
  ).toThrow(DesktopError)
})
