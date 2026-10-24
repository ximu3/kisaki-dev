// Validate the startup configuration and its cross-field rules with owned examples.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = new URL('./', import.meta.url)
const root = fileURLToPath(new URL('../../../../', here))
const ajvRoot = join(root, 'node_modules/.pnpm/ajv@8.20.0/node_modules/ajv')
const Ajv = createRequire(import.meta.url)(join(ajvRoot, 'dist/2020.js')).default
const sha = (value) => createHash('sha256').update(value).digest('hex')
const schemaPath = new URL('../../../design/projects/oauth-relay/config.schema.json', here)
const examplePath = new URL('../../../design/projects/oauth-relay/config.example.json', here)
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
const example = JSON.parse(readFileSync(examplePath, 'utf8'))
const matches = new Ajv({ strict: true, allErrors: true }).compile(schema)
const environment = Object.fromEntries(
  Object.values(example.applications['example-desktop'].providers).map((entry) => [
    entry.clientSecretEnv,
    'owned-fixture-value'
  ])
)

function requireConfig(config, env) {
  if (!matches(config)) throw new TypeError('Invalid configuration shape.')
  const origin = new URL(config.publicOrigin)
  if (origin.protocol !== 'https:' || origin.origin !== config.publicOrigin)
    throw new TypeError('Invalid public origin.')
  const registrations = new Set()
  for (const app of Object.values(config.applications)) {
    for (const value of app.corsOrigins ?? []) {
      const origin = new URL(value)
      if (origin.protocol !== 'https:' || origin.origin !== value)
        throw new TypeError('Invalid CORS origin.')
    }
    for (const redirect of app.redirects) {
      if (redirect.kind === 'loopback') {
        if (new URL(`http://127.0.0.1${redirect.path}`).pathname !== redirect.path)
          throw new TypeError('Invalid loopback path.')
        continue
      }
      const uri = new URL(redirect.uri)
      if (
        /\s/.test(redirect.uri) ||
        uri.hash ||
        uri.username ||
        uri.password ||
        ['http:', 'javascript:', 'data:', 'file:', 'about:', 'blob:'].includes(uri.protocol) ||
        ['code', 'state', 'error', 'error_description', 'reason'].some((key) =>
          uri.searchParams.has(key)
        )
      ) {
        throw new TypeError('Invalid fixed redirect.')
      }
    }
    for (const [provider, registration] of Object.entries(app.providers)) {
      if (!registration.defaultScopes.every((scope) => registration.allowedScopes.includes(scope)))
        throw new TypeError('Invalid default scopes.')
      if (provider === 'anilist' && registration.allowedScopes.length)
        throw new TypeError('Unsupported provider scopes.')
      const key = `${provider}\0${registration.clientId}`
      if (registrations.has(key)) throw new TypeError('Duplicate upstream registration.')
      registrations.add(key)
      if (
        typeof env[registration.clientSecretEnv] !== 'string' ||
        !env[registration.clientSecretEnv]
      )
        throw new TypeError('Missing secret environment reference.')
    }
  }
}

requireConfig(example, environment)
const rejected = []
for (const [name, change] of [
  [
    'literal secret in configuration',
    (config) => {
      config.applications['example-desktop'].providers.google.clientSecret =
        'owned-not-a-real-secret'
    }
  ],
  [
    'default scope outside allowlist',
    (config) => {
      config.applications['example-desktop'].providers.google.defaultScopes.push('unregistered')
    }
  ],
  [
    'public origin containing a path',
    (config) => {
      config.publicOrigin += '/unexpected'
    }
  ],
  [
    'same upstream registration in another application',
    (config) => {
      config.applications.other = structuredClone(config.applications['example-desktop'])
    }
  ],
  [
    'localhost in a literal loopback rule',
    (config) => {
      config.applications['example-desktop'].redirects[0].host = 'localhost'
    }
  ]
]) {
  const config = structuredClone(example)
  change(config)
  assert.throws(() => requireConfig(config, environment), TypeError)
  rejected.push(name)
}
assert.throws(() => requireConfig(example, {}), TypeError)
rejected.push('missing secret environment reference')
const result = {
  checkedAt: new Date().toISOString(),
  exampleAccepted: true,
  rejected,
  validator: {
    name: 'ajv',
    version: JSON.parse(readFileSync(join(ajvRoot, 'package.json'), 'utf8')).version,
    entrySha256: sha(readFileSync(join(ajvRoot, 'dist/2020.js')))
  },
  sources: Object.fromEntries(
    [
      '../../../design/projects/oauth-relay/config.example.json',
      '../../../design/projects/oauth-relay/config.schema.json',
      'check-config.mjs'
    ].map((name) => [name, sha(readFileSync(new URL(name, here)))])
  ),
  realEnvironmentSecretsRead: false,
  productionConfigurationImplemented: false
}
writeFileSync(new URL('configuration-contract.json', here), `${JSON.stringify(result, null, 2)}\n`)
process.stdout.write(`${JSON.stringify({ exampleAccepted: true, rejected: rejected.length })}\n`)
