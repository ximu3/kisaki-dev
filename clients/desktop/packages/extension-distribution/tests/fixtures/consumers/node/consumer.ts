/** @fileoverview Consumes only the installed tarball to sign, inspect and authenticate a registry. */

import { createPrivateKey } from 'node:crypto'
import { DistributionError } from '@kisaki3/extension-distribution/errors'
import { parseManifest } from '@kisaki3/extension-distribution/manifest'
import {
  generateRegistryKeyPair,
  inspectRegistry,
  signRegistry,
  verifyRegistry,
} from '@kisaki3/extension-distribution/node/signing'
import type { RegistryDocument } from '@kisaki3/extension-distribution/registry'

const keys = generateRegistryKeyPair()
const body: RegistryDocument = {
  schemaVersion: 1,
  id: 'example',
  publicKey: keys.publicKey,
  defaultLocale: 'en',
  name: 'Example',
  extensions: [],
}
const signed = signRegistry(JSON.stringify(body), createPrivateKey(keys.privateKey))
const inspection = inspectRegistry(signed)
const authenticated = verifyRegistry(signed, { id: body.id, publicKey: keys.publicKey })
const manifest = parseManifest(
  JSON.stringify({
    schemaVersion: 1,
    id: 'example.extension',
    version: '1.0.0',
    targets: ['linux-x64'],
    apiVersionRange: '^1',
    defaultLocale: 'en',
    name: 'Example extension',
    entry: 'entry.js',
  }),
)

let tamperCode: string | undefined
try {
  verifyRegistry(signed.replace('"Example"', '"Tampered"'), {
    id: body.id,
    publicKey: keys.publicKey,
  })
} catch (error) {
  if (!(error instanceof DistributionError)) {
    throw error
  }
  tamperCode = error.code
}

export const summary = {
  id: authenticated.id,
  fingerprintLength: inspection.fingerprint.length,
  entry: manifest.entry,
  tamperCode,
}
