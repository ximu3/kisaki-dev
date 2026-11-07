/** @fileoverview Signs original registry JSON and verifies explicitly trusted Ed25519 identities and bytes. */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  KeyObject,
  sign,
  verify,
} from 'node:crypto'
import canonicalize from 'canonicalize'
import { DistributionError } from '../errors'
import { parseId } from '../metadata'
import type { FileReference, SignedRegistry } from '../registry'
import { normalizeRegistry, parsePublicKey, parseSignature } from '../registry'
import { parseJson, record } from '../validation'

/** Domain separation for registry signatures; the final character is exactly one LF. */
export const registrySignaturePrefix = 'kisaki-extension-registry:v1\n'

/** The identity and public key previously accepted by the caller's trust owner. */
export interface RegistryTrust {
  readonly id: string
  readonly publicKey: string
}

/** Generated keys are returned to the caller only; this module never persists or publishes them. */
export interface RegistryKeyPair {
  readonly publicKey: string
  /** Unencrypted Ed25519 PKCS8 PEM; storage and encryption are caller responsibilities. */
  readonly privateKey: string
}

/** A self-consistent index offered for inspection, with no external identity authentication. */
export interface RegistryInspection {
  readonly registry: SignedRegistry
  /** Lowercase SHA-256 of the public SPKI DER bytes, independent of PEM line endings. */
  readonly fingerprint: string
}

/** Generate an Ed25519 SPKI/PKCS8 pair in memory, with no trust or filesystem side effects. */
export function generateRegistryKeyPair(): RegistryKeyPair {
  return generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
}

function publicKey(value: string): KeyObject {
  let key: KeyObject
  try {
    key = createPublicKey(parsePublicKey(value))
  } catch (cause) {
    throw new DistributionError('invalid-key', 'Invalid registry public key', ['publicKey'], {
      cause,
    })
  }

  if (key.asymmetricKeyType !== 'ed25519') {
    throw new DistributionError('invalid-key', 'Registry public key must use Ed25519', [
      'publicKey',
    ])
  }

  return key
}

function privateKey(value: string | KeyObject): KeyObject {
  let key: KeyObject
  try {
    key = value instanceof KeyObject ? value : createPrivateKey(value)
  } catch (cause) {
    throw new DistributionError('invalid-key', 'Invalid registry private key', [], { cause })
  }

  if (key.type !== 'private' || key.asymmetricKeyType !== 'ed25519') {
    throw new DistributionError('invalid-key', 'Registry private key must use Ed25519')
  }

  return key
}

/** Remove only the root signature from a fresh copy; nested names and all unknown fields remain. */
function unsignedBody(document: Record<string, unknown>): Record<string, unknown> {
  const body = { ...document }
  delete body.signature
  return body
}

/** Canonicalize already checked JSON using RFC8785 rather than a local serializer. */
function signingBytes(body: Record<string, unknown>): Buffer {
  return Buffer.from(registrySignaturePrefix + canonicalize(body)!, 'utf8')
}

/** Return the canonical, domain-separated bytes of valid original JSON without normalizing its fields. */
export function registrySigningPayload(text: string): Uint8Array {
  const body = unsignedBody(record(parseJson(text), []))
  normalizeRegistry(body)

  return signingBytes(body)
}

/**
 * Sign an original unsigned or previously signed document, replacing only its root signature.
 * The private key must match the declared public key. Returns complete JSON; performs no I/O or publishing.
 */
export function signRegistry(text: string, inputKey: string | KeyObject): string {
  const body = unsignedBody(record(parseJson(text), []))
  const registry = normalizeRegistry(body)

  const key = privateKey(inputKey)
  if (!createPublicKey(key).equals(publicKey(registry.publicKey))) {
    throw new DistributionError(
      'key-mismatch',
      'Signing key does not match the declared registry key',
      ['publicKey'],
    )
  }

  const signature = sign(null, signingBytes(body), key).toString('base64')
  return `${JSON.stringify({ ...body, signature }, null, 2)}\n`
}

/**
 * Authenticate original JSON with a previously accepted identity and key, then normalize known fields.
 * Rejects changed identity, keys, malformed JSON and signatures; never trusts a replacement key from the response.
 * Unknown fields and raw relative URLs participate in verification. The returned value is not signing input.
 */
export function verifyRegistry(text: string, trust: RegistryTrust): SignedRegistry {
  const document = record(parseJson(text), [])
  if (parseId(document.id, ['id']) !== parseId(trust.id)) {
    throw new DistributionError(
      'identity-mismatch',
      'Registry identity does not match the trusted identity',
      ['id'],
    )
  }

  const trusted = publicKey(trust.publicKey)
  const declared = publicKey(parsePublicKey(document.publicKey, ['publicKey']))
  if (!declared.equals(trusted)) {
    throw new DistributionError('key-mismatch', 'Registry key does not match the trusted key', [
      'publicKey',
    ])
  }

  const signature = parseSignature(document.signature, ['signature'])
  const body = unsignedBody(document)
  if (!verify(null, signingBytes(body), trusted, Buffer.from(signature, 'base64'))) {
    throw new DistributionError('invalid-signature', 'Registry signature verification failed', [
      'signature',
    ])
  }

  return { ...normalizeRegistry(body), signature }
}

/**
 * Check internal signature consistency for first-use inspection and return the key fingerprint.
 * This does not establish authorship or trust. Refreshes must call verifyRegistry with saved trust instead.
 */
export function inspectRegistry(text: string): RegistryInspection {
  const document = record(parseJson(text), [])
  const trust = {
    id: parseId(document.id, ['id']),
    publicKey: parsePublicKey(document.publicKey, ['publicKey']),
  }

  return {
    registry: verifyRegistry(text, trust),
    fingerprint: publicKeyFingerprint(trust.publicKey),
  }
}

/** Fingerprint validated Ed25519 SPKI bytes for display; no trust is established by computing it. */
export function publicKeyFingerprint(pem: string): string {
  return createHash('sha256')
    .update(publicKey(pem).export({ type: 'spki', format: 'der' }))
    .digest('hex')
}

/**
 * Check the byte count before hashing a complete downloaded resource. Mismatch rejects only this resource.
 * Downloading, streaming, cancellation and retention of existing installations belong to the caller.
 */
export function verifyFileBytes(bytes: Uint8Array, reference: FileReference): void {
  if (bytes.byteLength !== reference.size) {
    throw new DistributionError(
      'integrity-mismatch',
      'Resource byte count does not match its reference',
      ['size'],
    )
  }

  if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256) {
    throw new DistributionError(
      'integrity-mismatch',
      'Resource digest does not match its reference',
      ['sha256'],
    )
  }
}
