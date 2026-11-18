/** @fileoverview Owns atomic preference changes, protected proxy credentials and saved-state invalidation. */

import {
  parsePreferencesUpdate,
  type Preferences,
  type PreferencesUpdate,
} from '@kisaki3/desktop-contracts/preferences'
import { parseProxyCredentials } from '@kisaki3/desktop-contracts/network'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import { createSignal } from '../../infrastructure/events'
import { openSecret, protectSecret } from '../../infrastructure/credentials'
import type { DatabaseCall } from '../../infrastructure/database/executor'
import type { preferenceStorage } from './storage'
import type { Translate } from '@kisaki3/desktop-localization'
import { preferenceFields } from './fields'

/** Creates preference operations for the current data root and platform's defaults. */
export function createPreferences(
  call: DatabaseCall<ReturnType<typeof preferenceStorage>>,
  defaults: Preferences,
  translator: () => Translate,
) {
  /** Invalidates readers after an entire preference edit has committed. */
  const invalidated = createSignal<void>()
  return {
    /** Describes the field catalog in the effective software language. */
    async listFields() {
      return preferenceFields(translator())
    },
    /** Reads a fresh public snapshot, including only the opaque credential revision. */
    get: () => call('getPreferences'),
    /** Supplies a fresh reset draft without modifying storage. */
    async getDefaults() {
      return structuredClone(defaults)
    },
    /** Commits an edit, then notifies consumers so each can adopt the relevant saved values. */
    async update(input: PreferencesUpdate, options?: CallOptions) {
      const { changes, expected } = parsePreferencesUpdate(input)
      const { network, ...ordinary } = changes
      const { credentials, ...route } = network ?? {}
      const encrypted = credentials ? await protectSecret(JSON.stringify(credentials)) : credentials
      options?.signal?.throwIfAborted()
      const result = await call(
        'changePreferences',
        network ? { ...ordinary, network: route } : ordinary,
        expected ?? {},
        encrypted,
      )
      invalidated.emit()
      return result
    },
    /** Opens proxy credentials for an authenticated route, rewrapping only its original revision. */
    async readProxyCredentials(this: void, expectedRevision: string) {
      const { ciphertext, revision } = await call('getProxySecret')
      if (!ciphertext || revision !== expectedRevision) {
        throw new DesktopError('Conflict', 'The saved proxy credential changed during adoption')
      }
      const { result, shouldReEncrypt } = await openSecret(ciphertext)
      const credentials = parseProxyCredentials(JSON.parse(result))
      if (shouldReEncrypt) {
        await call('rotateProxySecret', revision, await protectSecret(result))
      }
      return credentials
    },
    onInvalidated: invalidated.on,
  }
}
