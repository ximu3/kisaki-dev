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
import {
  normalizeRegistry,
  parsePublicKey,
  parseSignature,
  type FileReference,
  type SignedRegistry,
} from '../registry'
import { parseJson, parseRecord } from '../validation'

export const registrySignaturePrefix = 'kisaki-extension-registry:v1\n'

export interface RegistryTrust {
  readonly id: string
  readonly publicKey: string
}

export interface RegistryKeyPair {
  readonly publicKey: string
  readonly privateKey: string
}

export interface RegistryInspection {
  readonly registry: SignedRegistry
  readonly fingerprint: string
}

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

function unsignedBody(document: Record<string, unknown>): Record<string, unknown> {
  const body = { ...document }
  delete body.signature
  return body
}

function signingBytes(body: Record<string, unknown>): Buffer {
  return Buffer.from(registrySignaturePrefix + canonicalize(body)!, 'utf8')
}

export function registrySigningPayload(text: string): Uint8Array {
  const body = unsignedBody(parseRecord(parseJson(text), []))
  normalizeRegistry(body)

  return signingBytes(body)
}

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

function verifyRegistryDocument(
  document: Record<string, unknown>,
  trust: RegistryTrust,
): SignedRegistry {
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

export function verifyRegistry(text: string, trust: RegistryTrust): SignedRegistry {
  return verifyRegistryDocument(parseRecord(parseJson(text), []), trust)
}

export function inspectRegistry(text: string): RegistryInspection {
  const document = parseRecord(parseJson(text), [])
  const trust = {
    id: parseId(document.id, ['id']),
    publicKey: parsePublicKey(document.publicKey, ['publicKey']),
  }

  return {
    registry: verifyRegistryDocument(document, trust),
    fingerprint: publicKeyFingerprint(trust.publicKey),
  }
}

export function publicKeyFingerprint(pem: string): string {
  return createHash('sha256')
    .update(publicKey(pem).export({ type: 'spki', format: 'der' }))
    .digest('hex')
}

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
