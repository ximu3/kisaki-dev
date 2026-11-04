/** @fileoverview Verifies select release behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'
import {
  parseApplicationRelease,
  parsePreparedApplicationUpdate,
} from '@kisaki3/desktop-contracts/updates'

import { selectApplicationRelease } from './select-release'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

test('desktop release selection uses the exact family and SemVer rather than order or publication time', () => {
  const release = (version: string, publishedAt: number) =>
    parseApplicationRelease({
      version,
      tagName: `desktop@${version}`,
      publishedAt,
      releaseUrl: 'https://example.test/release',
      delivery: { type: 'manual', downloadUrl: 'https://example.test/download.zip' },
    })
  const candidates = [release('1.2.0', 100), release('1.1.0', 300), release('2.0.0-beta.1', 200)]

  expect(selectApplicationRelease(candidates, '1.0.0')?.version).toBe('1.2.0')
  expect(selectApplicationRelease(candidates, '1.0.0', true)?.version).toBe('2.0.0-beta.1')
  expect(selectApplicationRelease(candidates, '3.0.0', true)).toBeNull()

  expect(() =>
    parseApplicationRelease({ ...candidates[0], tagName: 'extension-sdk@1.2.0' }),
  ).toThrow(DesktopError)

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
