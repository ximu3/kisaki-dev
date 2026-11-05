/** @fileoverview Checks independent font metadata and variable-axis constraints. */
import { expect, test } from 'vitest'
import { DesktopError } from './errors'
import { parseFontFileMetadata } from './fonts'

test('font metrics reject contradictory ranges without clamping', () => {
  const metric = { min: 100, default: 400, max: 900 }
  const metadata = {
    faces: [
      {
        index: 0,
        family: 'Synthetic',
        subfamily: 'Regular',
        fullName: null,
        postScriptName: null,
        weight: metric,
        width: { min: 100, default: 100, max: 100 },
        style: 'normal',
        axes: [{ tag: 'wght', ...metric }],
      },
    ],
  }

  expect(parseFontFileMetadata(metadata)).toEqual(metadata)

  expect(() =>
    parseFontFileMetadata({
      faces: [{ ...metadata.faces[0], weight: { min: 900, default: 400, max: 100 } }],
    }),
  ).toThrow(DesktopError)
})
