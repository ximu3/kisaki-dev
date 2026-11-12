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
import { parseJson, parseRecord } from '../validation'

/** Domain separation for registry signatures; the final character is exactly one LF. */
export const registrySignaturePrefix = 'kisaki-extension-registry:v1\n'

/** The identity and public key previously accepted by the caller's trust owner. */
export interface RegistryTrust {
  readonly id: string
  readonly publicKey: string
}

/** Ed25519 PEM key pair whose storage, encryption and publication belong to the caller. */
export interface RegistryKeyPair {
  /** Ed25519 public key in SPKI PEM form. */
  readonly publicKey: string
  /** Unencrypted Ed25519 PKCS8 PEM; storage and encryption are caller responsibilities. */
  readonly privateKey: string
}

/** Self-consistent registry data and a public-key fingerprint presented to the trust owner. */
export interface RegistryInspection {
  readonly registry: SignedRegistry
  /** Lowercase SHA-256 of the public SPKI DER bytes, independent of PEM line endings. */
  readonly fingerprint: string
}

/** Generates an Ed25519 SPKI public key and PKCS8 private key in memory. */
export function generateRegistryKeyPair(): RegistryKeyPair {
  return generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
}

/** Parses a declared SPKI PEM value into an Ed25519 public KeyObject. */
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

/** Accepts an Ed25519 private KeyObject or parses one from PEM, rejecting other key types. */
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

/**
 * Copies a registry object and removes its root signature.
 *
 * Nested signature-named fields and unknown data remain in the payload.
 */
function unsignedBody(document: Record<string, unknown>): Record<string, unknown> {
  const body = { ...document }
  delete body.signature
  return body
}

/** Encodes validated registry data with the purpose prefix and RFC8785 canonical JSON. */
function signingBytes(body: Record<string, unknown>): Buffer {
  return Buffer.from(registrySignaturePrefix + canonicalize(body)!, 'utf8')
}

/**
 * Builds canonical purpose-prefixed signing bytes from original registry JSON.
 *
 * Validates the structure without adopting normalized values. Only the root signature is excluded;
 * unknown fields and original field spellings remain covered.
 */
export function registrySigningPayload(text: string): Uint8Array {
  const body = unsignedBody(parseRecord(parseJson(text), []))
  normalizeRegistry(body)

  return signingBytes(body)
}

/**
 * Signs registry JSON with the supplied Ed25519 private key.
 *
 * Requires a key matching the document's declared public key. Preserves original field values,
 * replaces the root signature and returns complete signed JSON text.
 */
export function signRegistry(text: string, inputKey: string | KeyObject): string {
  const body = unsignedBody(parseRecord(parseJson(text), []))
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
 * Verifies original registry JSON against caller-saved identity and public key.
 *
 * Checks identity, key and signature before normalizing known fields. Verification covers unknown
 * fields and original field spellings. The returned value is normalized; original JSON remains the
 * signing input.
 */
export function verifyRegistry(text: string, trust: RegistryTrust): SignedRegistry {
  const document = parseRecord(parseJson(text), [])
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
 * Checks a registry's internal signature consistency and returns its key fingerprint.
 *
 * Uses the document's declared identity and key for first-use inspection. The caller decides trust;
 * subsequent refreshes use {@link verifyRegistry} with saved trust.
 */
export function inspectRegistry(text: string): RegistryInspection {
  const document = parseRecord(parseJson(text), [])
  const trust = {
    id: parseId(document.id, ['id']),
    publicKey: parsePublicKey(document.publicKey, ['publicKey']),
  }

  return {
    registry: verifyRegistry(text, trust),
    fingerprint: publicKeyFingerprint(trust.publicKey),
  }
}

/**
 * Returns lowercase SHA-256 of a validated Ed25519 public key's SPKI DER bytes.
 *
 * Equivalent PEM encodings produce the same display fingerprint; the caller owns the trust
 * decision.
 */
export function publicKeyFingerprint(pem: string): string {
  return createHash('sha256')
    .update(publicKey(pem).export({ type: 'spki', format: 'der' }))
    .digest('hex')
}

/**
 * Checks complete resource bytes against a validated reference's size and SHA-256.
 *
 * Checks size before hashing. Mismatches throw integrity-mismatch at size or sha256; downloading
 * and installation state belong to the caller.
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
