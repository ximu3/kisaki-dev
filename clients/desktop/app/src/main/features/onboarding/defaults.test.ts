/** @fileoverview Verifies defaults behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import {
  parseOnboardingState,
  parseOnboardingApplyInput,
  parseOnboardingApplyResult,
} from '@kisaki3/desktop-contracts/onboarding'
import { getOnboardingDefaults } from './defaults'

import { DesktopError } from '@kisaki3/desktop-contracts/errors'

import { parseStrictJson } from '@kisaki3/desktop-contracts/json'

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
