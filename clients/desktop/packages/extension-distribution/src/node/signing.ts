/** @fileoverview Signs and verifies original registry JSON with RFC 8785 JCS and pinned Ed25519 keys. */

import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto'
import { Buffer } from 'node:buffer'
import canonicalize from 'canonicalize'
import { visit } from 'jsonc-parser'
import { parseExtensionRegistry, type ExtensionRegistry } from '../registry'
import { DistributionError } from '../validation'

/** Domain separation for registry signatures; the newline is one LF byte. */
export const registrySignaturePrefix = 'kisaki-extension-registry:v1\n'

/**
 * Sign a complete JSON document without writing files or publishing. The included publicKey must
 * belong to the private key. Only the root signature is removed; all unknown members remain signed.
 */
export function signRegistry(json: string, privateKeyPem: string): string {
  const document = parseOriginal(json)
  parseExtensionRegistry({ ...document, signature: 'pending' })
  const key = createPrivateKey(privateKeyPem)
  requireEd25519(key)
  const publicKey = requirePublicKey(document.publicKey)
  if (
    !publicKey
      .export({ type: 'spki', format: 'der' })
      .equals(createPublicKey(key).export({ type: 'spki', format: 'der' }))
  ) {
    throw new DistributionError(
      'InvalidSignature',
      'The registry public key does not match the signing key.',
    )
  }
  const signature = sign(null, signingBytes(document), key).toString('base64')
  return JSON.stringify({ ...document, signature }, null, 2) + '\n'
}

/** Verify original bytes with the trusted key before any normalization or URL resolution. */
export function verifyRegistry(json: string, trustedPublicKeyPem: string): ExtensionRegistry {
  const document = parseOriginal(json)
  const trusted = requirePublicKey(trustedPublicKeyPem)
  const included = requirePublicKey(document.publicKey)
  if (
    !trusted
      .export({ type: 'spki', format: 'der' })
      .equals(included.export({ type: 'spki', format: 'der' }))
  ) {
    throw new DistributionError(
      'InvalidSignature',
      'The registry key differs from the trusted key.',
    )
  }
  if (typeof document.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(document.signature)) {
    throw new DistributionError('InvalidSignature', 'Invalid Ed25519 signature encoding.')
  }
  const signature = Buffer.from(document.signature, 'base64')
  if (
    signature.toString('base64') !== document.signature ||
    !verify(null, signingBytes(document), trusted, signature)
  ) {
    throw new DistributionError('InvalidSignature', 'Registry signature verification failed.')
  }
  return parseExtensionRegistry(document)
}

/** Reject duplicate properties before JSON.parse could erase evidence of ambiguity. */
function parseOriginal(json: string): Record<string, unknown> {
  const objects: Set<string>[] = []
  let invalid = false
  visit(
    json,
    {
      onObjectBegin: () => {
        objects.push(new Set())
      },
      onObjectProperty: (name) => {
        const current = objects.at(-1)
        if (!current || current.has(name)) {
          invalid = true
        }
        current?.add(name)
      },
      onObjectEnd: () => {
        objects.pop()
      },
      onError: () => {
        invalid = true
      },
    },
    { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false },
  )
  if (invalid) {
    throw new DistributionError('InvalidFormat', 'The registry is not unambiguous JSON.')
  }
  const value: unknown = JSON.parse(json)
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DistributionError('InvalidFormat', 'The registry must be a JSON object.')
  }
  // The JSON parser established data properties; canonicalize validates finite numbers and Unicode.
  return value as Record<string, unknown>
}

/** Canonicalize the original unsigned root with the RFC's existing JCS implementation. */
function signingBytes(document: Record<string, unknown>): Buffer {
  const unsigned = Object.fromEntries(
    Object.entries(document).filter(([key]) => key !== 'signature'),
  )
  try {
    const canonical = canonicalize(unsigned)
    if (canonical === undefined) {
      throw new Error('Missing canonical document')
    }
    return Buffer.from(registrySignaturePrefix + canonical, 'utf8')
  } catch (cause) {
    throw new DistributionError('InvalidFormat', 'The registry cannot be represented by JCS.', {
      cause,
    })
  }
}

/** Read only a public SPKI Ed25519 key; no alternate key algorithm is negotiated. */
function requirePublicKey(value: unknown): KeyObject {
  if (typeof value !== 'string' || !value.startsWith('-----BEGIN PUBLIC KEY-----')) {
    throw new DistributionError('InvalidSignature', 'An Ed25519 SPKI public key is required.')
  }
  try {
    const key = createPublicKey({ key: value, type: 'spki', format: 'pem' })
    requireEd25519(key)
    return key
  } catch (cause) {
    throw new DistributionError('InvalidSignature', 'Invalid Ed25519 public key.', { cause })
  }
}

function requireEd25519(key: KeyObject): void {
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new DistributionError('InvalidSignature', 'An Ed25519 key is required.')
  }
}
