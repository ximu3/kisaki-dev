# @kisaki3/extension-distribution

Kisaki extension manifests, flat registry indexes, static metadata, compatibility rules and Ed25519 signatures. The package provides ESM and TypeScript declarations through independent subpaths. It owns no application state, network requests, installation, archive extraction or publishing workflow.

| Entry           | Responsibility                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `manifest`      | Complete package facts, JSON parsing and package-relative file paths                                |
| `registry`      | Index formats, resource references, release selection and immutable-version checks                  |
| `metadata`      | Opaque IDs, localized static text, author and display fields                                        |
| `compatibility` | Six targets, SemVer versions/ranges and host-condition diagnostics                                  |
| `errors`        | `DistributionError`, stable error codes and field paths                                             |
| `node/signing`  | In-memory key generation, original-document signing, explicit trust verification and byte integrity |

The five pure entries run in Node and modern browsers. They use standard `Intl` and `URL` facilities without accessing a DOM, filesystem or host state. `node/signing` requires Node 24.11.1 or later; TypeScript Node consumers supply their normal `@types/node` environment. Pure declarations require neither Node nor DOM globals. Supported module resolution is NodeNext or Bundler; CommonJS consumers use dynamic import.

## Package facts and static text

```ts
import { parseManifest } from '@kisaki3/extension-distribution/manifest'
import { resolveLocalizedText } from '@kisaki3/extension-distribution/metadata'

const manifest = parseManifest(manifestJson)
const label = resolveLocalizedText(manifest.name, 'zh-CN', manifest.defaultLocale)
```

`parseManifest` reads strict JSON. `normalizeManifest` accepts JSON-compatible data from an existing document parser. Both return a new value with canonical locale identifiers and sorted targets. They supply no missing fields and do not modify the input. The format version is `1`; the package's npm version, extension version and extension API range are separate values.

Required manifest fields are `schemaVersion`, `id`, `version`, `apiVersionRange`, `targets`, `entry`, `defaultLocale` and `name`. Optional fields are `description`, `categories`, `keywords`, `icon`, `readme`, `author`, `license`, `homepage`, `repository`, `issues`, `nodeVersionRange` and `electronVersionRange`. An author has `name` and optional `url`. The built Node entry, icon and readme use package-relative file paths. These checks do not establish file existence or valid ESM; archive owners must also reject symlinks, file/directory collisions and paths that change ownership on the actual filesystem.

IDs allow a single segment or dot-separated segments. Each segment starts with a lowercase letter, contains lowercase letters, digits and hyphens, and ends with a letter or digit. A prefix does not establish ownership, permissions or a domain name.

`LocalizedText` is literal text or a locale-to-text object. `normalizeLocalizedText` canonicalizes keys, rejects canonical alias collisions, and requires the declared default. Text is preserved, including whitespace and message-like characters. `resolveLocalizedText` tries an exact canonical tag, then uses `Intl.Locale.maximize()` and FormatJS matching within the same language and writing system, then the declared default. Candidate order is stable. It does not interpolate messages or convert Chinese scripts.

Known display categories are `metadata`, `integration`, `theme`, `tool` and `language`. Authors validate new category values with `parseCategory`; readers retain unknown category strings for generic display. Categories and keywords do not confer capabilities or affect loading. URL fields are validated without rewriting their original spelling; the operation that fetches or opens a URL owns its scheme and network policy.

## Registry parsing and selection

```ts
import { selectRelease, resolveFileReference } from '@kisaki3/extension-distribution/registry'

const selected = selectRelease(
  extension,
  {
    target: 'windows-arm64',
    apiVersion: '1.2.0',
    nodeVersion: '24.11.1',
    electronVersion: '42.0.0',
  },
  { allowPrerelease: false, newerThan: '1.0.0' },
)

if (selected) {
  const download = resolveFileReference(selected.artifact, finalResponseUrl)
}
```

`RegistryDocument` is the unsigned flat body. `SignedRegistry` adds the root `signature`. `parseRegistry` and `parseSignedRegistry` parse strict JSON; `normalizeRegistry` checks an existing JSON-compatible value. These functions validate structure and normalize known fields, but do not authenticate the document. Unknown JSON fields are accepted and omitted from the normalized projection. Keep original JSON for signature operations: unknown fields remain signed, and normalized objects are not signing inputs.

The body contains `schemaVersion`, `id`, `publicKey`, `defaultLocale`, `name`, optional `description`, and `extensions`. Each listing has an ID, static display metadata, optional icon reference and nonempty releases. Releases contain `version`, first-publication `publishedAt` in UTC milliseconds, `defaultLocale`, optional localized Markdown `releaseNotes`, optional readme reference, and nonempty artifacts. An artifact has target and runtime requirements, optional license, and `{ url, size, sha256 }`. Sizes are original byte counts and hashes are lowercase SHA-256 hexadecimal.

Targets are `windows-x64`, `windows-arm64`, `macos-x64`, `macos-arm64`, `linux-x64` and `linux-arm64`. Each release target belongs to exactly one artifact. `targetForPlatform` maps Node OS and process architecture values, returning `undefined` for unsupported pairs. `getCompatibilityIssues` reports all unmet target/API/Node/Electron requirements. A missing runtime fails its explicitly declared requirement. SemVer range prerelease rules apply to runtime versions independently of extension release preferences.

`selectRelease` returns the highest compatible release and its concrete artifact, or `undefined` if none exists. Prereleases are excluded by default. `newerThan` restricts automatic updates to strictly greater precedence. Equal-precedence releases, including versions differing only in build metadata, are conflicts. Upload time and array order do not select a winner. Callers retain a selection through download and verification; a failure is reported rather than followed by implicit fallback.

`getCurrentRelease` chooses the highest stable version, or the highest prerelease if no stable version exists. It ignores host conditions and installation state. Publishers derive current display fields from that version's actual manifest and resources. `assertCommonMetadata` checks shared display fields across platform manifests; publishers must compare the actual shared icon/readme bytes separately.

`assertManifestMatchesArtifact` checks package ID, exact version, targets, compatibility declarations and license after the package bytes have been verified. Current listing text is deliberately excluded. The archive owner verifies the declared entry and resources in the extracted package.

`assertRegistryUpdate` compares two validated indexes. Retained versions cannot change bytes, compatibility, license, target membership, exact version, first publication time or release default locale. New targets require a new version. Resource URL relocation and release-note corrections can retain the version. Releases and listings may be removed; the package does not maintain permanent history or infer effects on local installations.

## Sign original JSON and verify explicit trust

```ts
import {
  generateRegistryKeyPair,
  inspectRegistry,
  signRegistry,
  verifyRegistry,
} from '@kisaki3/extension-distribution/node/signing'

const keys = generateRegistryKeyPair()
const unsignedJson = JSON.stringify({
  schemaVersion: 1,
  id: 'my.registry',
  publicKey: keys.publicKey,
  defaultLocale: 'en',
  name: 'My registry',
  extensions: [],
})
const signedJson = signRegistry(unsignedJson, keys.privateKey)

const inspection = inspectRegistry(signedJson)
// Here the caller owns the key. A third-party repository requires an explicit first-use decision.
const verified = verifyRegistry(signedJson, { id: 'my.registry', publicKey: keys.publicKey })
```

Signing uses Node Ed25519 over UTF-8 `kisaki-extension-registry:v1\n` followed by RFC8785 JCS of the original document with only its root `signature` removed. Unknown fields, nested fields called `signature`, original locale spelling and relative URLs all participate. Duplicate decoded property names, invalid Unicode, nonfinite numbers and non-JSON data are rejected. Reformatting JSON or changing property order does not alter the signature input. `registrySigningPayload` exposes the exact bytes for interoperability checks.

`signRegistry` accepts original JSON plus an Ed25519 PKCS8 PEM or private `KeyObject`. It requires the private key to match the document's SPKI public key, replaces only the root signature, and returns complete signed JSON. It does not save keys, upload files or establish trust. Key generation returns an unencrypted private key in memory; the caller owns storage and protection.

`inspectRegistry` verifies internal consistency with the response's own declared key and returns the normalized index and a lowercase SHA-256 fingerprint of SPKI DER. This is information for a first-use decision, not external author authentication. Refreshes call `verifyRegistry` with a previously accepted `{ id, publicKey }`; a response cannot replace that trust. Equivalent PEM line endings identify the same trusted key, while edits to the signed declaration still require a new signature. Signatures do not prove code safety or catalog freshness.

Resolve resource URLs only after verification, always against the final index response URL. Keep that base with cached indexes and transmitted fragments. `verifyFileBytes` checks length before digest and throws on mismatch; it does not modify installation state. Downloading, cancellation, extraction, entry loading and release of occupied resources belong to the operation owner.

## Errors, build and verification

Rejected inputs throw `DistributionError` with a stable `code` and a `path` of property names and array indexes. Messages are safe English diagnostics, and wrapped failures retain their cause. The synchronous pure and cryptographic operations hold no persistent resources and do not need cancellation or disposal. Network and filesystem callers own those lifetimes.

```sh
pnpm --filter @kisaki3/extension-distribution typecheck
pnpm --filter @kisaki3/extension-distribution test
pnpm exec turbo run test:consumers --filter=@kisaki3/extension-distribution
```

The consumer task builds a complete candidate, packs once, checks that tarball with publint and Are the Types Wrong, and installs it into independent Node and browser projects outside the repository. Both run complete declaration checks (`skipLibCheck: false`) and typed lint. Node checks actual signing; Chromium runs every pure entry. Prepare Chromium with `pnpm --filter @kisaki3/extension-distribution exec playwright install chromium` when needed.

The package is MIT licensed. Its dependencies remain external npm packages and retain their own license files; no third-party implementation is copied into this tarball. Implementation dependencies are pinned in the package manifest and workspace lockfile. Build, pack and tests perform no external publishing.
