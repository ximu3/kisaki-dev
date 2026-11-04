/** @fileoverview Selects initial onboarding choices from the native product catalogs. */

import type { OnboardingState } from '@kisaki3/desktop-contracts/onboarding'

/** Initial singleton state says nothing has been presented or adopted; it does not itself open onboarding. */
export function getOnboardingDefaults(): OnboardingState {
  return { firstPresentedAt: null, firstCompletedAt: null, lastPresentedVersion: null, handled: {} }
}
