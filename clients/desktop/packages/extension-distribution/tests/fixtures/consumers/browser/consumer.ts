/** @fileoverview Exercises every pure public entry without Node or DOM declaration dependencies. */

import { DistributionError } from '@kisaki3/extension-distribution/errors'
import { normalizeManifest } from '@kisaki3/extension-distribution/manifest'
import { resolveLocalizedText } from '@kisaki3/extension-distribution/metadata'
import {
  getCompatibilityIssues,
  targetForPlatform,
} from '@kisaki3/extension-distribution/compatibility'
import {
  parseRegistry,
  selectRelease,
  resolveFileReference,
} from '@kisaki3/extension-distribution/registry'

const manifest = normalizeManifest({
  schemaVersion: 1,
  id: 'browser.sample',
  version: '1.0.0',
  targets: ['linux-x64'],
  apiVersionRange: '^1',
  defaultLocale: 'en',
  name: { en: 'Example', 'zh-Hans': '示例', 'zh-Hant': '範例' },
  entry: 'entry.js',
})
const registry = parseRegistry(
  JSON.stringify({
    schemaVersion: 1,
    id: 'browser.registry',
    publicKey:
      '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=\n-----END PUBLIC KEY-----\n',
    defaultLocale: 'en',
    name: 'Example registry',
    extensions: [
      {
        id: manifest.id,
        defaultLocale: 'en',
        name: 'Current example',
        releases: [
          {
            version: '1.0.0',
            publishedAt: 1_700_000_000_000,
            defaultLocale: 'en',
            artifacts: [
              {
                targets: manifest.targets,
                apiVersionRange: manifest.apiVersionRange,
                url: './sample.kisx',
                size: 10,
                sha256: 'a'.repeat(64),
              },
            ],
          },
        ],
      },
    ],
  }),
)
const environment = { target: targetForPlatform('linux', 'x64')!, apiVersion: '1.1.0' }
const selected = selectRelease(registry.extensions[0]!, environment)!
let errorCode: string | undefined
try {
  parseRegistry('{"id":"a","id":"b"}')
} catch (error) {
  if (!(error instanceof DistributionError)) {
    throw error
  }
  errorCode = error.code
}

export const summary = {
  simplified: resolveLocalizedText(manifest.name, 'zh-CN', manifest.defaultLocale),
  traditional: resolveLocalizedText(manifest.name, 'zh-TW', manifest.defaultLocale),
  compatible: getCompatibilityIssues(manifest, environment).length === 0,
  version: selected.release.version,
  url: resolveFileReference(selected.artifact, 'https://example.org/releases/index.json').url,
  errorCode,
}
