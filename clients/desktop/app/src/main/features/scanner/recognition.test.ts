/** @fileoverview Checks recognizers contribute actual new clues beyond their original input. */
import { expect, test } from 'vitest'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { acceptRecognitionResult } from './recognition'

test('recognizers return new usable clues or an explicit null', () => {
  const input = {
    entryType: 'game' as const,
    path: '/fixture/game',
    kind: 'directory' as const,
    clues: { name: 'Name' },
  }

  expect(acceptRecognitionResult(input, null)).toBeNull()

  expect(() => acceptRecognitionResult(input, { name: '  NAME  ' })).toThrow(DesktopError)

  expect(
    acceptRecognitionResult(input, { externalIdentities: [{ source: 'vndb', sourceId: 'v17' }] }),
  ).toEqual({ externalIdentities: [{ source: 'vndb', sourceId: 'v17' }] })
})
