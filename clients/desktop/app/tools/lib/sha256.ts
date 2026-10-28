/** @fileoverview Provides SHA-256 byte digests for desktop resource and build receipts. */

import { createHash } from 'node:crypto'

/** Return the lowercase hexadecimal SHA-256 digest of the supplied bytes. */
export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
