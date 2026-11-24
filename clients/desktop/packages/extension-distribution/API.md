# Reading and verifying extension releases

Use the portable manifest, registry, metadata and compatibility entries for parsing and selection. Use `/node/signing` for Node signing and verification. Classify failures by the `DistributionError` code and inspect its field path to locate invalid data.

## Reading metadata

Read manifest and registry text as strict JSON. Duplicate decoded member names, trailing commas and malformed Unicode are rejected. Known fields are returned in normalized form. Preserve the original registry text for signature verification, including unknown signed fields. Check package-relative paths against real archive entries when extracting or loading an extension.

Locale maps must contain the declared default locale. Keys that become duplicates after locale normalization are invalid. A supplied empty translation remains a valid string. Manifest display text and the current listing may differ.

## Choosing a release

Select using the host OS and process architecture and the runtimes actually available. A missing runtime cannot satisfy a declared range for it. The listing uses the highest stable release for its display metadata, falling back to the highest prerelease when needed. Installation selects the highest compatible release under the caller's prerelease and installed-version constraints. Build metadata does not break a SemVer precedence tie. No qualifying release yields `undefined`.

Keep the selected release and artifact fixed during download. Resolve relative references against the final index response URL. Check the original byte count and SHA-256 digest before using an artifact. Compare the verified manifest with the selected release and artifact, including identity, full version, targets, runtime requirements and license.

## Authenticating a registry

`inspectRegistry` inspects a self-signed registry before the user establishes trust. `verifyRegistry` requires the caller's trusted identity and key. Embedded key material alone grants no authority. Signing covers the complete canonical JSON document with its root signature removed and the protocol prefix applied. Do not reconstruct signing input from a normalized projection.

Compare retained releases with the previous trusted snapshot. Their full version, publication time and default locale stay fixed. Retained artifacts keep their content, metadata and target sets. Deletions, URL relocation and corrections to release notes are allowed.
