/** @fileoverview Verifies original-byte trust boundaries, RFC8785 payloads and resource integrity. */

import { expect, test } from 'vitest'
import { createHash, createPublicKey, generateKeyPairSync, verify } from 'node:crypto'
import {
  generateRegistryKeyPair,
  inspectRegistry,
  publicKeyFingerprint,
  registrySigningPayload,
  signRegistry,
  verifyFileBytes,
  verifyRegistry,
} from '../src/node/signing'
import { registry } from './support/fixtures'

const keys = generateRegistryKeyPair()
const trust = { id: 'sample.registry', publicKey: keys.publicKey }

test('Node Ed25519 independently verifies the exact purpose-prefixed JCS payload', () => {
  const body = {
    ...registry([], keys.publicKey),
    extensions: [],
    extra: { z: -0, a: 1e-7, nested: { signature: 'retained' }, unicode: '🌸' },
  }
  const text = JSON.stringify(body)
  const signed = signRegistry(text, keys.privateKey)
  const document = JSON.parse(signed) as { signature: string }
  // This expected order is intentionally independent of the package's canonicalizer.
  const expected = `kisaki-extension-registry:v1\n{"defaultLocale":"en","extensions":[],"extra":{"a":1e-7,"nested":{"signature":"retained"},"unicode":"🌸","z":0},"id":"sample.registry","name":"Sample registry","publicKey":${JSON.stringify(keys.publicKey)},"schemaVersion":1}`
  expect(Buffer.from(registrySigningPayload(text)).toString('utf8')).toBe(expected)
  expect(
    verify(
      null,
      Buffer.from(expected),
      createPublicKey(keys.publicKey),
      Buffer.from(document.signature, 'base64'),
    ),
  ).toBe(true)
  expect(
    verify(
      null,
      Buffer.from(expected.replace('v1\n', 'v2\n')),
      createPublicKey(keys.publicKey),
      Buffer.from(document.signature, 'base64'),
    ),
  ).toBe(false)
  expect(verifyRegistry(signed, trust).id).toBe(trust.id)
  expect(signRegistry(signed, keys.privateKey)).toBe(signed)
})

test('signature verification precedes locale normalization and covers unknown and nested signature fields', () => {
  const input = {
    ...registry(undefined, keys.publicKey),
    defaultLocale: 'EN-us',
    name: { 'EN-us': 'Registry' },
    extra: { signature: 'nested-signature', text: 'kept' },
  }
  const signed = signRegistry(JSON.stringify(input), keys.privateKey)
  expect(verifyRegistry(signed, trust)).toMatchObject({
    defaultLocale: 'en-US',
    name: { 'en-US': 'Registry' },
  })
  expect(signed).toContain('EN-us')
  expect(signed).toContain('nested-signature')
  for (const edited of [
    signed.replaceAll('EN-us', 'en-US'),
    signed.replace('nested-signature', 'changed'),
    signed.replace('"kept"', '"changed"'),
    signed.replace('./sample.kisx', 'https://example.org/sample.kisx'),
  ]) {
    expect(() => verifyRegistry(edited, trust)).toThrowError(
      expect.objectContaining({ code: 'invalid-signature' }),
    )
  }
  // JSON formatting and member order are not signed; the exact JSON data is.
  const reordered = Object.fromEntries(
    Object.entries(JSON.parse(signed) as Record<string, unknown>).reverse(),
  )
  expect(verifyRegistry(JSON.stringify(reordered), trust).id).toBe(trust.id)
})

test('inspection checks internal consistency but refreshes require the caller-saved identity and key', () => {
  const signed = signRegistry(JSON.stringify(registry(undefined, keys.publicKey)), keys.privateKey)
  const inspection = inspectRegistry(signed)
  expect(inspection.registry.publicKey).toBe(keys.publicKey)
  expect(inspection.fingerprint).toBe(publicKeyFingerprint(keys.publicKey))
  const replacement = generateRegistryKeyPair()
  const replaced = signRegistry(
    JSON.stringify(registry(undefined, replacement.publicKey)),
    replacement.privateKey,
  )
  expect(() => verifyRegistry(replaced, trust)).toThrowError(
    expect.objectContaining({ code: 'key-mismatch' }),
  )
  expect(() => verifyRegistry(signed, { ...trust, id: 'another.registry' })).toThrowError(
    expect.objectContaining({ code: 'identity-mismatch' }),
  )
  expect(() =>
    signRegistry(JSON.stringify(registry(undefined, keys.publicKey)), replacement.privateKey),
  ).toThrowError(expect.objectContaining({ code: 'key-mismatch' }))
  expect(() => inspectRegistry(signed.replace('Sample registry', 'Changed registry'))).toThrowError(
    expect.objectContaining({ code: 'invalid-signature' }),
  )
})

test('equivalent PEM encodings identify the same key but signed declarations keep their original bytes', () => {
  const signed = signRegistry(JSON.stringify(registry(undefined, keys.publicKey)), keys.privateKey)
  const windowsPem = keys.publicKey.replaceAll('\n', '\r\n')
  expect(publicKeyFingerprint(windowsPem)).toBe(publicKeyFingerprint(keys.publicKey))
  expect(verifyRegistry(signed, { ...trust, publicKey: windowsPem }).id).toBe(trust.id)
  const changed = JSON.parse(signed) as Record<string, unknown>
  changed.publicKey = windowsPem
  expect(() => verifyRegistry(JSON.stringify(changed), trust)).toThrowError(
    expect.objectContaining({ code: 'invalid-signature' }),
  )
})

test('non-Ed25519 keys and malformed Base64 are rejected without key material in diagnostics', () => {
  const rsa = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  expect(() => publicKeyFingerprint(rsa.publicKey)).toThrowError(
    expect.objectContaining({ code: 'invalid-key' }),
  )
  expect(() =>
    signRegistry(JSON.stringify(registry(undefined, rsa.publicKey)), rsa.privateKey),
  ).toThrowError(expect.objectContaining({ code: 'invalid-key' }))
  const signed = signRegistry(JSON.stringify(registry(undefined, keys.publicKey)), keys.privateKey)
  const document = JSON.parse(signed) as Record<string, unknown>
  for (const signature of [
    '',
    '%%%%',
    `${'A'.repeat(85)}B==`,
    'A'.repeat(88),
    `${'A'.repeat(86)}==\n`,
  ]) {
    expect(() => verifyRegistry(JSON.stringify({ ...document, signature }), trust)).toThrowError(
      expect.objectContaining({ code: 'invalid-format', path: ['signature'] }),
    )
  }
})

test('JSON duplicates and non-JCS values cannot be hidden inside otherwise valid signed documents', () => {
  const signed = signRegistry(JSON.stringify(registry(undefined, keys.publicKey)), keys.privateKey)
  for (const inserted of ['"extra":{"a":1,"\\u0061":2},', '"id":"sample.registry",']) {
    const duplicate = signed.replace('{', `{${inserted}`)
    const expected: unknown = expect.objectContaining({ code: 'duplicate-property' })
    expect(() => verifyRegistry(duplicate, trust)).toThrowError(expected)
    expect(() => signRegistry(duplicate, keys.privateKey)).toThrowError(expected)
  }
  for (const inserted of ['"extra":1e400,', '"extra":"\\udfff",', '"\\udfff":1,']) {
    expect(() => signRegistry(signed.replace('{', `{${inserted}`), keys.privateKey)).toThrow()
  }
})

test('unknown prototype-named JSON fields remain signed data without modifying object prototypes', () => {
  const text = JSON.stringify(registry(undefined, keys.publicKey)).replace(
    '{',
    '{"__proto__":{"signature":"data"},"constructor":"data",',
  )
  const signed = signRegistry(text, keys.privateKey)
  expect(signed).toContain('"__proto__"')
  expect(verifyRegistry(signed, trust).id).toBe(trust.id)
  expect(() =>
    verifyRegistry(signed.replace('"constructor": "data"', '"constructor": "changed"'), trust),
  ).toThrowError(expect.objectContaining({ code: 'invalid-signature' }))
  expect(Object.hasOwn(Object.prototype, 'signature')).toBe(false)
})

test('resource checks use original bytes and report size before digest mismatches', () => {
  const bytes = Buffer.from('资源\n', 'utf8')
  const reference = {
    url: './resource.md',
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
  expect(() => verifyFileBytes(bytes, reference)).not.toThrow()
  expect(() => verifyFileBytes(bytes.subarray(1), reference)).toThrowError(
    expect.objectContaining({ code: 'integrity-mismatch', path: ['size'] }),
  )
  const corrupted = Buffer.from(bytes)
  corrupted[0] = 0
  expect(() => verifyFileBytes(corrupted, reference)).toThrowError(
    expect.objectContaining({ code: 'integrity-mismatch', path: ['sha256'] }),
  )
})
