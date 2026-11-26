# Using desktop contracts

Import the subpath for the capability you use. The package supplies portable values, type contracts, parsers and canonical encodings. The desktop host executes operations. A parsed value establishes its shape and constraints. The host still checks current state, resource ownership and permission when it performs the operation.

`parseJsonValue` from `/json` snapshots ordinary finite JSON data. It accepts shared children and rejects cycles, accessors, sparse arrays, extra array properties, symbols and non-enumerable data. It reads data properties without evaluating getters. Use `parseStrictJson` for JSON text.

For an extension contribution, pass `{ type: 'mdi', name: 'account-circle-outline' }` or a package file icon. The `/ui` subpath exports `MdiIconName` and `parseMdiIconName`. Both use the pinned MDI names and aliases without the `mdi:` prefix. Search results use the same names and carry the owning extension ID for package files.

## Calls, lists and writes

Pass cancellation through the operation's call options. The operation owns completion and any cleanup. A request to stop may arrive after a commit. A lost connection leaves the remote outcome unknown. Re-read durable state before retrying a write. Use the stable error code or structured partial outcome for decisions. Display messages and local causes are unsuitable as identifiers.

`/operations` lists take an offset and limit and return a page plus the matching total. `/library` query projections and keyed results follow the submitted keys and target kind. Preserve stable identity and use the established ordering when requesting later pages. Submit writes with the expected values for the fields being changed. Treat a conflict as a request to refresh and resolve the differences. Omitted input, an explicitly empty collection and a stored null can express different operations.

`/date` represents partial dates without inventing a missing month or day. `/paths` represents host paths according to their platform. `/text-rules` requires the host to run user pattern compilation, matching and expansion inside a bounded, terminable execution unit.

## Resources, files and networking

Treat read references, preparations, view URLs and registrations as owned resources. Retain a read while using its contents. Bind references for the view that will consume them. Once binding succeeds, you can dispose of the original read. Each view holds its own binding and disposes of it when finished. Persist an attachment reference through the owning write before discarding the preparation. The preparation is transient. A display URL or open handle cannot substitute for a persistent attachment ID.

A credential-bearing HTTP file input must explicitly reject redirects when a nonempty Authorization or Cookie header is present. Use the host networking operation for approved requests and observe the response and body lifetime. Release image and font preparations even if later validation or saving fails. When a theme or translation becomes temporarily unavailable, distinguish the saved choice from the fallback actually presented.

## Tasks, events and sessions

Task admission, execution and waiting are separate operations. Cancelling a wait leaves the task running. A live waiter can receive a valid result even if the final history write fails. After the live run has been released, a new wait reads the last saved checkpoint. An unconfirmed completion is reported as interrupted. Use the current task state to determine which control actions are available.

Treat a fact notification as a reason to refresh the corresponding query. Registration and disposal belong to the subscriber's lifetime. For playback or reading, use the session's actual file and its position format. Retrying pending recordings preserves unresolved work and does not reopen the content or duplicate activities already saved.

## Host-managed operations

A metadata or scanner configuration edit supplies the affected comparison baselines. Validate user-defined text rules within the owning execution budget. Use the import or ingest result to distinguish confirmed changes, partial results and unresolved inputs. Extension registrations and view resources expire with their owner.

Application exit, a data-location change, update preparation and onboarding have separate completion points. Choosing the next data location does not move an open database. Compare onboarding baselines before accepting recommended changes. Same-database groups commit together. If a later extension installation fails, previously established installation outcomes remain. Skipping recommendations leaves work already accepted running. Use the view's own feedback handle for loading and persistent messages and release it when its owner ends.

## Comparing private writes and preferences

For `/private-data`, omit `expectedRevision` to write unconditionally, pass `null` to require absence, or pass a revision to compare it. A stored JSON null still has a revision. A missing key has no record. A batch commits value and secret mutations atomically within the actual caller's namespace. A failed comparison or encryption preserves the previous contents. Successful sets return fresh revisions, deletes return null, and unrelated keys are omitted. Read secret state to check its presence without decrypting it.

Preference updates compare and commit all submitted fields together. Arrays and identity choices are whole-field replacements. Use the original opaque revision for a protected-credential edit. Runtime adoption follows the commit. Getting defaults leaves both the saved preferences and the editor's draft intact. Parse shortcut accelerators for the target platform before comparing conflicts. An explicit modifier and a platform-dependent CommandOrControl can resolve differently.

## Library reads and batch writes

A work's completion count is the number of individual records plus `record.additionalCompletionCount`. A record requires a complete date or a nonblank note. Adding or deleting one leaves the additional count alone. The completion list counts actual rows. Undated records and additional completions contribute to all-time totals and the unknown-date count, and stay out of calendar groups. Use `completions.initialize` to adopt an initial count and its details together on a work with zero total completions. Pass an empty records array for a count alone. It returns the IDs of the new detail rows in order.

Subscribe to invalidation before the first library read. If a change arrives during the read, read again. Keep drafts independent of query results. An omitted update field preserves its value. Use null only for fields that permit clearing. Whole-set membership comparisons include hidden associations and apply to replacement operations. A missing target or mismatched baseline rejects a complete entry-edit batch. A graph write prepares resources, rechecks references and baselines, and commits the graph together.

Ingest batches commit individual targets independently. An item failure permits later items to run. After cancellation the total still reflects the input size, and the outcome contains only completed items and valid partial results. Match them to their original input indices. A metadata processor can replace a requested field value. Its result must preserve the original keys, field types and matching evidence. Complete results cover every key of a fixed request. Closing a metadata read session rejects new reads and waits for admitted reads before releasing its resources.

A scanner's saved or historical definition can still be read when some referenced implementations are unavailable. Parsing its stored shape does not compile user patterns. Saving or executing a definition requires its full validation. An accepted scan and the readiness of its file watcher have separate lifetimes.

## Coordinates, bytes and paths

Normalized source-page coordinates range from zero to one with a top-left origin and downward positive y. Rectangles have positive extents and fit wholly inside the source page. Quadrilaterals are convex and clockwise, starting at the topmost and then leftmost vertex. Resolve display rotation, zoom and rounding before storing a position. Literal path filters preserve wildcard characters. In globs, recursive matching uses a whole `**` segment. Absolute-path syntax checks preserve spelling. Filesystem operations determine link targets and name equivalence.

An attachment inspection reports missing or unreadable content. Repair requires complete bytes matching the registered digest. Cleanup rechecks references and holds before deleting an orphan. An image transform selects a zero-based frame for animation, corrects source orientation, flips, rotates clockwise, then crops in the resulting pixel coordinates. The returned static PNG has its own hold. A failure preserves the source.

HTTP fetch resolves when headers arrive, including HTTP error statuses. The body can be consumed once. Cancel an unused stream to release it. Cancelling after headers can still fail a pending body read. When applying a network route fails, new HTTP requests and WebSocket handshakes are blocked. An established browser WebSocket retains its original route until closure.

## Sessions, extensions and host identity

An active session close waits for final recording and resource cleanup. Concurrent closes share completion. Closing an ended session does not retry a failed recording. A file switch that fails after ending the previous session returns a `previousEnded` partial result. Only `ready` confirms the switch. Use recording retry to settle remaining work.

A refreshed extension registry replaces the verified cache only after checking saved trust. A package can remain installed after activation fails. Read the installation receipt or partial result before retrying. A prepared update is separate from activation. For application updates, a successful check with no candidate returns null and an unsuccessful check rejects. Starting a later check or preparation preserves the last check outcome and any verified update.

A search with empty text succeeds with zero results. Navigating to a search target opens its view without starting the content. Extension deeplinks preserve ordered repeated query keys, empty path components and an explicitly empty fragment. Formatting a request performs no lookup or installation. In development, build numbers increase per extension on a connection. Keep each build directory intact until its readers release it. A ready connection can still lack an extension API or an active extension.
