/** Record authoritative package metadata and documentation receipts without executing source content. */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const probe = JSON.parse(await readFile(join(root, 'probe-results.json'), 'utf8'))
const requests = [
  ...probe.dependencies.map(({ name, version }) => ({
    kind: 'package',
    url: `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`,
    name,
    version
  })),
  ...[
    'https://formatjs.github.io/docs/intl-messageformat/',
    'https://formatjs.github.io/docs/core-concepts/icu-syntax/',
    'https://formatjs.github.io/docs/icu-messageformat-parser/',
    'https://formatjs.github.io/docs/polyfills/intl-localematcher/',
    'https://tc39.es/ecma402/'
  ].map((url) => ({ kind: 'documentation', url }))
]
const settled = await Promise.allSettled(
  requests.map(async (request) => {
    const response = await fetch(request.url, { signal: AbortSignal.timeout(20000) })
    const bytes = Buffer.from(await response.arrayBuffer())
    const receipt = {
      ...request,
      status: response.status,
      finalUrl: response.url,
      checkedAt: new Date().toISOString(),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex')
    }
    if (!response.ok) throw new Error(`Source request failed with HTTP ${response.status}.`)
    if (request.kind === 'package') {
      const metadata = JSON.parse(bytes)
      if (metadata.name !== request.name || metadata.version !== request.version)
        throw new Error('Package metadata identity does not match.')
      receipt.license = metadata.license
      receipt.gitHead = metadata.gitHead ?? null
      receipt.repository = metadata.repository
      receipt.dist = { integrity: metadata.dist.integrity, tarball: metadata.dist.tarball }
    }
    return receipt
  })
)
const failed = settled.filter((result) => result.status === 'rejected')
if (failed.length) {
  for (const result of failed) console.error(result.reason.message)
  process.exitCode = 1
} else {
  const result = {
    checkedOn: '2026-10-17',
    sourceContentExecuted: false,
    installedDependencies: probe.dependencies,
    receipts: settled.map((entry) => entry.value)
  }
  await writeFile(join(root, 'dependency-contract.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(
    JSON.stringify({
      dependencies: result.installedDependencies.length,
      receipts: result.receipts.length,
      allStatus200: result.receipts.every((entry) => entry.status === 200)
    })
  )
}
