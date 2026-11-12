/** @fileoverview Checks onboarding request baselines and independently durable partial results. */

import { expect, test } from 'vitest'
import {
  parseOnboardingState,
  parseOnboardingApplyInput,
  parseOnboardingApplyResult,
} from './onboarding'
import { DesktopError } from './errors'
import { parseStrictJson } from './json'

test('onboarding requests retain baselines and distinguish atomic data groups from durable installation', () => {
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

  const showcase = {
    group: 'showcase',
    items: [
      {
        itemId: 'collections',
        expectedHandled: null,
        input: {
          name: 'Collections',
          query: { kind: 'collection', search: '', sort: { type: 'scope' } },
          layout: 'horizontal',
          itemSize: 'md',
          limit: 12,
          openMode: 'page',
          isVisible: true,
        },
      },
    ],
  }

  expect(parseOnboardingApplyInput(showcase)).toEqual(showcase)

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
