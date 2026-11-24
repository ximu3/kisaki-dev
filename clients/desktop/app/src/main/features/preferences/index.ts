import { parsePreferencesUpdate, type Preferences } from '@kisaki3/desktop-contracts/preferences'
import { parseProxyCredentials } from '@kisaki3/desktop-contracts/network'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import { createSignal } from '../../infrastructure/events'
import { openSecret, protectSecret } from '../../infrastructure/credentials'
import type { DatabaseCall } from '../../infrastructure/database/executor'
import type { preferenceStorage } from './storage'
import type { Translate } from '@kisaki3/desktop-localization'
import { preferenceFields } from './fields'

export function createPreferences(
  call: DatabaseCall<ReturnType<typeof preferenceStorage>>,
  defaults: Preferences,
  translator: () => Translate,
) {
  const invalidated = createSignal<void>()

  return {
    async listFields(options?: CallOptions) {
      options?.signal?.throwIfAborted()
      return preferenceFields(translator())
    },
    async get(options?: CallOptions) {
      options?.signal?.throwIfAborted()
      return call('getPreferences')
    },
    async getDefaults(options?: CallOptions) {
      options?.signal?.throwIfAborted()
      return structuredClone(defaults)
    },

    async update(input: unknown, options?: CallOptions) {
      options?.signal?.throwIfAborted()
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
