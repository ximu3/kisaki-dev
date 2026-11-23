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
  try {
    return await safeStorage.encryptStringAsync(value)
  } catch (cause) {
    throw new DesktopError(
      'CredentialProtectionUnavailable',
      'System credential protection could not encrypt the value',
      { cause },
    )
  }
}

/** Opens one saved secret and reports the system's key-rotation request to its owner. */
export async function openSecret(ciphertext: Uint8Array) {
  await requireProtection()
  try {
    return await safeStorage.decryptStringAsync(Buffer.from(ciphertext))
  } catch (cause) {
    // Electron 45 exposes OSCrypt's temporary failure as a distinct rejection message.
    if (
      cause instanceof Error &&
      cause.message.startsWith('safeStorage.decryptStringAsync is temporarily unavailable.')
    ) {
      throw new DesktopError(
        'CredentialProtectionUnavailable',
        'System credential protection is temporarily unavailable',
        { cause },
      )
    }
    throw new DesktopError('CredentialUnreadable', 'The saved credential cannot be opened', {
      cause,
    })
  }
}
