/** @fileoverview Verifies management receipts, native fact boundaries and safe state projections independent of host execution. */

import { expect, test } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { DesktopError, parseExecutionFailure } from '../src/errors'
import {
  parseDevelopmentAdoptionResult,
  parseDevelopmentBuild,
  parseDevelopmentReady,
} from '../src/development'
import {
  parsePreparedExtensionUpdate,
  parseExtensionApplyUpdatesResult,
  parseExtensionRepositoryUpdate,
} from '../src/extensions'
import {
  parseApplicationRelease,
  parsePreparedApplicationUpdate,
  selectApplicationRelease,
} from '../src/updates'
import {
  getOnboardingDefaults,
  parseOnboardingApplyInput,
  parseOnboardingApplyResult,
  parseOnboardingState,
} from '../src/onboarding'
import {
  extensionEvent,
  parseExtensionEventPayload,
  parseExtensionEventRef,
  parseNativeEventPayload,
} from '../src/events'
import { parseLibraryChange } from '../src/library/changes'
import { parsePlaybackSettingResult, parseSessionEnded, parseWorkSession } from '../src/sessions'
import { parseTaskState, projectTaskHistory } from '../src/tasks'
import {
  parseApplicationEnvironment,
  formatApplicationEnvironment,
  dataModeRequiresRestart,
} from '../src/app'
import { parseJsonValue, parseStrictJson } from '../src/json'

test('development receipts identify actual requested builds and preserve interrupted unknowns', () => {
  const builds = [
    { extensionId: 'example.ext', buildId: 1 },
    { extensionId: 'second.ext', buildId: 2 },
  ]
  const partial = {
    outcome: 'interrupted',
    error: { code: 'Cancelled', message: 'Cancelled' },
    builds: [{ ...builds[0], outcome: 'adopted' }],
    activations: [],
  }
  expect(parseDevelopmentAdoptionResult(partial, builds)).toEqual(partial)
  expect(() =>
    parseDevelopmentAdoptionResult(
      { outcome: 'completed', builds: partial.builds, activations: [] },
      builds,
    ),
  ).toThrow(DesktopError)
  expect(() =>
    parseDevelopmentAdoptionResult(
      { ...partial, builds: [{ extensionId: 'example.ext', buildId: 2, outcome: 'adopted' }] },
      builds,
    ),
  ).toThrow(DesktopError)
  expect(
    parseDevelopmentReady({ appVersion: '0.1.0-dev.0', apiVersion: null, buildId: 'app-build' })
      .apiVersion,
  ).toBeNull()
  expect(() =>
    parseDevelopmentBuild({
      extensionId: 'example.ext',
      buildId: 1,
      rootPath: '/fixture/build',
      webviews: [
        { document: { root: 'ui', entry: 'index.html' }, url: 'https://example.test/index.html' },
      ],
    }),
  ).toThrow(DesktopError)
  expect(
    parseDevelopmentBuild({
      extensionId: 'example.ext',
      buildId: 1,
      rootPath: '/fixture/build',
      webviews: [
        { document: { root: 'ui', entry: 'index.html' }, url: 'http://127.0.0.1:12345/index.html' },
      ],
    }).buildId,
  ).toBe(1)
})

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

test('onboarding keeps explicit baselines and distinguishes atomic data groups from durable installation before marking', () => {
  expect(parseOnboardingState(getOnboardingDefaults())).toEqual(getOnboardingDefaults())
  const preference = {
    group: 'preferences',
    items: [
      {
        itemId: 'preferences',
        expectedHandled: null,
        input: {
          changes: { general: { closeMainWindow: 'quit' } },
          expected: { general: { closeMainWindow: 'background' } },
        },
      },
    ],
  }
  expect(parseOnboardingApplyInput(preference)).toEqual(preference)
  expect(() =>
    parseOnboardingApplyInput({
      ...preference,
      items: [
        {
          ...preference.items[0],
          input: { changes: { network: { mode: 'direct' } }, expected: {} },
        },
      ],
    }),
  ).toThrow(DesktopError)
  expect(() =>
    parseOnboardingApplyInput({
      ...preference,
      items: [
        {
          ...preference.items[0],
          input: { changes: { general: { closeMainWindow: 'quit' } }, expected: {} },
        },
      ],
    }),
  ).toThrow(DesktopError)
  expect(() =>
    parseOnboardingApplyResult({
      group: 'scanner',
      items: [
        {
          itemId: 'one',
          outcome: 'applied',
          resources: [{ type: 'scanConfig', configId: 'c' }],
          issues: [],
        },
        { itemId: 'two', outcome: 'notApplied', resources: [], issues: [] },
      ],
    }),
  ).toThrow(DesktopError)
  const installed = {
    group: 'extensions',
    items: [
      {
        itemId: 'one',
        outcome: 'notApplied',
        resources: [{ type: 'extension', extensionId: 'example.ext' }],
        issues: [{ stage: 'commit', error: { code: 'Conflict', message: 'Handling changed' } }],
      },
      { itemId: 'two', outcome: 'notStarted', resources: [], issues: [] },
    ],
  }
  expect(parseOnboardingApplyResult(installed)).toEqual(installed)
  const dictionary = parseStrictJson(
    '{"firstPresentedAt":null,"firstCompletedAt":null,"lastPresentedVersion":null,"handled":{"__proto__":{"outcome":"skipped","handledAt":1}}}',
  )
  expect(Object.hasOwn(parseOnboardingState(dictionary).handled, '__proto__')).toBe(true)
})

test('session lifecycle facts retain actual launch snapshots and distinguish detach from failed final recording', () => {
  const context = {
    sessionId: 's',
    gameId: 'g',
    launchConfigId: 'config',
    startedAt: 1,
    saveSource: {
      type: 'snapshot',
      launchConfigId: 'config',
      launchConfigName: 'Launch',
      path: '/fixture/save',
    },
  }
  expect(parseNativeEventPayload('sessions.game.sessionStarted', context)).toEqual(context)
  expect(parseSessionEnded('game', { ...context, endedAt: 2, reason: 'detached' }).reason).toBe(
    'detached',
  )
  expect(() =>
    parseSessionEnded('game', {
      ...context,
      endedAt: 2,
      reason: 'detached',
      recordingError: { code: 'WriteFailed', message: 'Not saved' },
    }),
  ).toThrow(DesktopError)
  expect(() => parseSessionEnded('game', { ...context, endedAt: 2, reason: 'replaced' })).toThrow(
    DesktopError,
  )
  expect(() =>
    parseWorkSession({
      ...context,
      type: 'game',
      timing: { paused: true, counting: true, elapsedMs: 1, graceEndsAt: null },
      monitoring: { available: true, foreground: true },
    }),
  ).toThrow(DesktopError)
  expect(() =>
    parseNativeEventPayload('sessions.game.sessionStarted', {
      ...context,
      saveSource: { ...context.saveSource, launchConfigId: 'other' },
    }),
  ).toThrow(DesktopError)
})

test('library facts carry only applicable identity context and preserve kind-correction identity', () => {
  expect(
    parseLibraryChange({
      type: 'partKindChanged',
      fromPart: { type: 'animeEpisode', id: 'content' },
      toPart: { type: 'animeExtra', id: 'content' },
      work: { type: 'anime', id: 'a' },
    }).type,
  ).toBe('partKindChanged')
  expect(() =>
    parseLibraryChange({
      type: 'partKindChanged',
      fromPart: { type: 'animeEpisode', id: 'old' },
      toPart: { type: 'animeExtra', id: 'new' },
      work: { type: 'anime', id: 'a' },
    }),
  ).toThrow(DesktopError)
  expect(() =>
    parseLibraryChange({
      type: 'annotationDeleted',
      annotationId: 'annotation',
      work: { type: 'game', id: 'g' },
      fileId: null,
    }),
  ).toThrow(DesktopError)
  expect(() =>
    parseLibraryChange({
      type: 'entryDeleted',
      snapshot: {
        ref: { type: 'game', id: 'g' },
        name: 'Game',
        externalIdentities: [],
        description: 'Private body',
      },
    }),
  ).toThrow(DesktopError)
})

test('extension events bind their finite reference and parser, while safe failures retain legal partial results', () => {
  expect(() => parseExtensionEventRef('app.ready')).toThrow(DesktopError)
  expect(() => parseExtensionEventRef('example:local:extra')).toThrow(DesktopError)
  const contract = extensionEvent('example.ext:changed', (value) => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      throw new TypeError('Expected an integer')
    }
    return value
  })
  expect(parseExtensionEventPayload(contract, 3)).toBe(3)
  expect(() => parseExtensionEventPayload(contract, '3')).toThrow(TypeError)
  const partialResult = {
    sessionId: 's',
    animeId: 'a',
    fileId: 'f',
    outcome: 'saved',
    saved: { field: 'muted', scope: 'application', value: false },
  }
  expect(
    parseExecutionFailure(
      { code: 'UnrecognizedRemoteCode', message: 'Saved but not applied', partialResult },
      parsePlaybackSettingResult,
    ).partialResult,
  ).toEqual(partialResult)
  expect(() =>
    parseExecutionFailure(
      { code: 'Cancelled', message: 'Cancelled', partialResult: {} },
      parsePlaybackSettingResult,
    ),
  ).toThrow(DesktopError)
})

test('terminal task affordances and historical interruption never manufacture resumed work or lost results', () => {
  expect(() =>
    parseTaskState({
      taskRunId: 't',
      status: 'completed',
      progress: null,
      canPause: false,
      canResume: false,
      canCancel: true,
    }),
  ).toThrow(DesktopError)
  const run = {
    id: 't',
    type: 'example',
    title: 'Example',
    description: null,
    status: 'running' as const,
    input: {},
    result: { saved: true },
    error: null,
    createdAt: 1,
    startedAt: 2,
    finishedAt: null,
  }
  expect(projectTaskHistory(run, false)).toEqual({ ...run, status: 'interrupted' })
  expect(projectTaskHistory(run, true)).toBe(run)
  expect(() =>
    parseNativeEventPayload('tasks.finished', {
      taskRunId: 't',
      type: 'example',
      status: 'failed',
      result: null,
      error: null,
      finishedAt: 3,
    }),
  ).toThrow(DesktopError)
})

test('safe environment and data-mode projections report actual scope without paths in clipboard content', () => {
  const environment = {
    version: '1.0.0',
    operatingSystem: { name: 'Example OS', version: '1' },
    architecture: 'arm64' as const,
  }
  expect(formatApplicationEnvironment(environment)).toBe('Kisaki 1.0.0\nExample OS 1\narm64')
  expect(() => parseApplicationEnvironment({ ...environment, dataRoot: '/private' })).toThrow(
    DesktopError,
  )
  expect(
    dataModeRequiresRestart({
      current: { mode: 'normal', path: '/normal' },
      normalPath: '/normal',
      portable: { status: 'available', path: '/portable', nextMode: 'portable' },
    }),
  ).toBe(true)
  expect(
    dataModeRequiresRestart({
      current: { mode: 'normal', path: '/normal' },
      normalPath: '/normal',
      portable: {
        status: 'unavailable',
        error: { code: 'ReadFailed', message: 'Marker unavailable' },
      },
    }),
  ).toBeNull()
  expect(() => parseStrictJson('{"a":1,"\\u0061":2}')).toThrow(DesktopError)
  const sparse: number[] = []
  sparse.length = 2
  sparse[1] = 1
  expect(() => parseJsonValue(sparse)).toThrow(DesktopError)
})
