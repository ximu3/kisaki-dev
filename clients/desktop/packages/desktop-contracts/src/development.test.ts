/**
 * @fileoverview Verifies accepted development protocol facts and rejection of unsupported
 * message fields.
 */

import { expect, test } from 'vitest'
import { parseDevelopmentCommand, parseDevelopmentEvent } from './development'

test('validates build facts and rejects unknown fields and outcomes', () => {
  expect(
    parseDevelopmentCommand({
      type: 'buildsReady',
      builds: [{ extensionId: 'fixture', buildId: 1, rootPath: '/complete', webviews: [] }],
    }),
  ).toMatchObject({ type: 'buildsReady' })
  expect(
    parseDevelopmentEvent({
      type: 'adoptionResult',
      outcome: 'completed',
      builds: [{ extensionId: 'fixture', buildId: 1, outcome: 'adopted' }],
      activations: [
        {
          extensionId: 'fixture',
          outcome: 'failed',
          error: { code: 'fixture', message: 'Fixture failure' },
        },
      ],
    }),
  ).toMatchObject({ outcome: 'completed' })

  expect(() => parseDevelopmentCommand({ type: 'stop', requestId: 'unexpected' })).toThrow()
  expect(() =>
    parseDevelopmentCommand({ type: 'initialize', protocolVersion: 1, sessionId: 'unexpected' }),
  ).toThrow()

  expect(() =>
    parseDevelopmentEvent({
      type: 'adoptionResult',
      outcome: 'completed',
      builds: [{ extensionId: 'fixture', buildId: 1, outcome: 'unknown' }],
      activations: [],
    }),
  ).toThrow()
})
