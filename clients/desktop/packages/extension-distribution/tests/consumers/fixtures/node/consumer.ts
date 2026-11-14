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

/** Ephemeral registry key pair created by the installed Node signing entry point. */
const keys = generateRegistryKeyPair()

/** Synthetic unsigned registry document owned by this independent consumer. */
const body: RegistryDocument = {
  schemaVersion: 1,
  id: 'example',
  publicKey: keys.publicKey,
  defaultLocale: 'en',
  name: 'Example',
  extensions: [],
}

/** Exact signed registry bytes produced from the synthetic document. */
const signed = signRegistry(JSON.stringify(body), createPrivateKey(keys.privateKey))

/** Unauthenticated identity and key-fingerprint inspection of the signed bytes. */
const inspection = inspectRegistry(signed)

/** Registry content authenticated against the explicitly pinned synthetic trust identity. */
const authenticated = verifyRegistry(signed, { id: body.id, publicKey: keys.publicKey })

/** Synthetic manifest parsed through the installed distribution entry point. */
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

/** Observed verification failure code after intentional modification of signed content. */
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

/** Node-observed authentication, manifest and tamper-detection results. */
export const summary = {
  id: authenticated.id,
  fingerprintLength: inspection.fingerprint.length,
  entry: manifest.entry,
  tamperCode,
}
