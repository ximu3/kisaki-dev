/** @fileoverview Verifies management behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'

import {
  parsePreparedExtensionUpdate,
  parseExtensionRepositoryUpdate,
  parseExtensionApplyUpdatesResult,
} from './extensions'
import { DesktopError } from './errors'

test('prepared extension identities retain explicit trust and cannot substitute another artifact', () => {
  // A synthetic key proves the source format, without depending on a user's repository trust or credentials.
  const publicKey = generateKeyPairSync('ed25519')
    .publicKey.export({ format: 'pem', type: 'spki' })
    .toString()
  const source = {
    type: 'repository',
    repositoryId: 'repo',
    extensionId: 'example.ext',
    version: '1.0.0',
    sha256: 'a'.repeat(64),
    declaredId: 'example.repo',
    trustedPublicKey: publicKey,
  }
  const update = {
    extensionId: 'example.ext',
    version: '1.0.0',
    sha256: 'a'.repeat(64),
    targets: ['windows-x64'],
    source,
  }

  expect(parsePreparedExtensionUpdate(update).source).toEqual(source)

  expect(() => parsePreparedExtensionUpdate({ ...update, sha256: 'b'.repeat(64) })).toThrow(
    DesktopError,
  )

  expect(() =>
    parseExtensionRepositoryUpdate({
      changes: { url: 'https://example.test/index.json' },
      expected: { declaredId: 'unrelated' },
    }),
  ).toThrow(DesktopError)

  const report = {
    adopted: [
      { extensionId: 'example.ext', version: '1.0.0', sha256: 'a'.repeat(64), outcome: 'adopted' },
    ],
    activations: [
      {
        extensionId: 'other.ext',
        outcome: 'failed',
        error: { code: 'OperationFailed', message: 'Activation failed' },
      },
    ],
  }

  expect(parseExtensionApplyUpdatesResult(report)).toEqual(report)
})
