import { expect, test } from 'vitest'
import { parseDevelopmentCommand, parseDevelopmentEvent } from './development'

test('validates finite build facts and rejects removed transport and queue fields', () => {
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
  expect(() => parseDevelopmentCommand({ type: 'stop', requestId: 'removed' })).toThrow()
  expect(() =>
    parseDevelopmentCommand({ type: 'initialize', protocolVersion: 1, sessionId: 'removed' }),
  ).toThrow()
  expect(() =>
    parseDevelopmentEvent({
      type: 'adoptionResult',
      outcome: 'completed',
      builds: [{ extensionId: 'fixture', buildId: 1, outcome: 'superseded' }],
      activations: [],
    }),
  ).toThrow()
})
