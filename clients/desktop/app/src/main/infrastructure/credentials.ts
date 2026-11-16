/** @fileoverview Protects and opens application secrets with Electron's asynchronous operating-system storage. */

import { safeStorage } from 'electron'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

/** Requires a usable system secret service before submitting plaintext or opening ciphertext. */
async function requireProtection() {
  if (
    !(await safeStorage.isAsyncEncryptionAvailable()) ||
    (process.platform === 'linux' &&
      ['basic_text', 'unknown'].includes(safeStorage.getSelectedStorageBackend()))
  ) {
    throw new DesktopError(
      'CredentialProtectionUnavailable',
      'System credential protection is unavailable',
    )
  }
}

/** Encrypts a new secret before the transaction that commits it. */
export async function protectSecret(value: string) {
  await requireProtection()
  return safeStorage.encryptStringAsync(value)
}

/** Opens one saved secret and reports the system's key-rotation request to its owner. */
export async function openSecret(ciphertext: Uint8Array) {
  await requireProtection()
  try {
    return await safeStorage.decryptStringAsync(Buffer.from(ciphertext))
  } catch (cause) {
    throw new DesktopError('CredentialUnreadable', 'The saved credential cannot be opened', {
      cause,
    })
  }
}
