/** @fileoverview Parses and formats native and extension deeplinks using strict, single-decoding URL semantics. */

import * as v from 'valibot'
import { objectSchema } from './schema'
import { parseExtensionId } from '@kisaki3/extension-distribution/identity'
import { partialDateSchema, type PartialDate } from './date'
import { ExecutionError, invalidInput } from './errors'
import {
  entryIdentifierSchema,
  entryTypes,
  externalIdentitySchema,
  type EntryIdentifier,
  type EntryType,
  type ExternalIdentity,
} from './library/identity'
import { parsePlaybackPositionInput, type PlaybackPositionInput } from './library/playback'
import { parseReadingPositionInput, type ReadingPositionInput } from './library/reading'
import { nonemptyStringSchema, parseContract } from './validation'

/** Protocol identity belongs to an installed application; it is not an extension-owned scheme. */
export type DeeplinkScheme = 'kisaki' | 'kisaki-dev'
/** An extension's decoded business input; order, duplicate names, empty values, and empty fragments matter. */
export interface ExtensionDeeplinkRequest {
  readonly path: readonly string[]
  readonly query: readonly (readonly [name: string, value: string])[]
  readonly fragment?: string
}

type EpisodeSelection =
  | { readonly episodeId?: string; readonly extraId?: never }
  | { readonly episodeId?: never; readonly extraId?: string }
type Positioned<Position> =
  | { readonly fileId: string; readonly position?: Position }
  | { readonly fileId?: never; readonly position?: never }
/** Exact native work selection; position always names its actual file and never changes a preference. */
export type DeeplinkOpenTarget =
  | {
      readonly type: 'game'
      readonly identifier: EntryIdentifier
      readonly launchConfigId?: string
    }
  | ({ readonly type: 'anime'; readonly identifier: EntryIdentifier } & EpisodeSelection &
      Positioned<PlaybackPositionInput>)
  | ({
      readonly type: 'comic'
      readonly identifier: EntryIdentifier
      readonly volumeId?: string
      readonly chapterId?: string
    } & Positioned<ReadingPositionInput>)
  | ({
      readonly type: 'novel'
      readonly identifier: EntryIdentifier
      readonly volumeId?: string
    } & Positioned<ReadingPositionInput>)

/** Public native views are deliberately finite; internal dialogs do not automatically receive URLs. */
export type DeeplinkViewTarget =
  | { readonly type: 'library' | 'preferences' }
  | { readonly type: EntryType; readonly identifier?: never }
  | {
      readonly type: 'game'
      readonly identifier: EntryIdentifier
      readonly launchConfigId?: string
    }
  | ({
      readonly type: 'anime'
      readonly identifier: EntryIdentifier
      readonly fileId?: string
    } & EpisodeSelection)
  | {
      readonly type: 'comic'
      readonly identifier: EntryIdentifier
      readonly volumeId?: string
      readonly chapterId?: string
      readonly fileId?: string
    }
  | {
      readonly type: 'novel'
      readonly identifier: EntryIdentifier
      readonly volumeId?: string
      readonly fileId?: string
    }
  | { readonly type: 'character' | 'person' | 'organization'; readonly identifier: EntryIdentifier }
  | { readonly type: 'collection' | 'tag' | 'note'; readonly id?: string }
  | { readonly type: 'tasks'; readonly runId?: string }
  | { readonly type: 'scanner'; readonly configId?: string; readonly runId?: string }
  | { readonly type: 'metadataProfiles'; readonly profileId?: string }
  | { readonly type: 'extensions'; readonly extensionId?: string; readonly pageId?: string }

type AddDateClues = {
  game: { readonly releaseDate?: PartialDate }
  anime: { readonly releaseDate?: PartialDate }
  comic: { readonly releaseDate?: PartialDate }
  novel: { readonly releaseDate?: PartialDate }
  character: { readonly birthDate?: PartialDate }
  person: { readonly birthDate?: PartialDate }
  organization: { readonly foundedDate?: PartialDate }
}
/** Public add links carry only the documented clues and at most one complete external identity. */
export type DeeplinkAddRequest = {
  [Type in EntryType]: {
    readonly type: 'add'
    readonly entryType: Type
    readonly clues: {
      readonly name?: string
      readonly originalName?: string
      readonly externalIdentities?: readonly [ExternalIdentity]
    } & AddDateClues[Type]
    readonly profileId?: string
  }
}[EntryType]
/** A pure business request. Receiving, ownership, current facts, and actual execution belong to app. */
export type DeeplinkRequest =
  | { readonly type: 'view'; readonly target: DeeplinkViewTarget }
  | { readonly type: 'open'; readonly target: DeeplinkOpenTarget }
  | DeeplinkAddRequest
  | ({ readonly type: 'extension'; readonly extensionId: string } & ExtensionDeeplinkRequest)

const optionalId = v.exactOptional(nonemptyStringSchema)
const gameSelection = { launchConfigId: optionalId }
const animeSelection = { episodeId: optionalId, extraId: optionalId, fileId: optionalId }
const comicSelection = { volumeId: optionalId, chapterId: optionalId, fileId: optionalId }
const novelSelection = { volumeId: optionalId, fileId: optionalId }
const entryViewSchemas = [
  objectSchema({ type: v.picklist(entryTypes) }),
  objectSchema({ type: v.literal('game'), identifier: entryIdentifierSchema, ...gameSelection }),
  v.pipe(
    objectSchema({
      type: v.literal('anime'),
      identifier: entryIdentifierSchema,
      ...animeSelection,
    }),
    v.check((value) => value.episodeId === undefined || value.extraId === undefined),
  ),
  objectSchema({ type: v.literal('comic'), identifier: entryIdentifierSchema, ...comicSelection }),
  objectSchema({ type: v.literal('novel'), identifier: entryIdentifierSchema, ...novelSelection }),
  objectSchema({
    type: v.picklist(['character', 'person', 'organization']),
    identifier: entryIdentifierSchema,
  }),
] as const
const viewSchema = v.union([
  ...entryViewSchemas,
  objectSchema({ type: v.picklist(['library', 'preferences']) }),
  objectSchema({ type: v.picklist(['collection', 'tag', 'note']), id: optionalId }),
  objectSchema({ type: v.literal('tasks'), runId: optionalId }),
  objectSchema({ type: v.literal('scanner'), configId: optionalId, runId: optionalId }),
  objectSchema({ type: v.literal('metadataProfiles'), profileId: optionalId }),
  v.pipe(
    objectSchema({ type: v.literal('extensions'), extensionId: optionalId, pageId: optionalId }),
    v.check((value) => value.pageId === undefined || value.extensionId !== undefined),
  ),
])
const playbackPositionSchema = v.custom<PlaybackPositionInput>((value) => {
  try {
    parsePlaybackPositionInput(value)
    return true
  } catch {
    return false
  }
})
const readingPositionSchema = v.custom<ReadingPositionInput>((value) => {
  try {
    parseReadingPositionInput(value)
    return true
  } catch {
    return false
  }
})
const openSchema = v.union([
  objectSchema({ type: v.literal('game'), identifier: entryIdentifierSchema, ...gameSelection }),
  v.pipe(
    objectSchema({
      type: v.literal('anime'),
      identifier: entryIdentifierSchema,
      ...animeSelection,
      position: v.exactOptional(playbackPositionSchema),
    }),
    v.check(
      (value) =>
        (value.episodeId === undefined || value.extraId === undefined) &&
        (value.position === undefined || value.fileId !== undefined),
    ),
  ),
  v.pipe(
    objectSchema({
      type: v.literal('comic'),
      identifier: entryIdentifierSchema,
      ...comicSelection,
      position: v.exactOptional(readingPositionSchema),
    }),
    v.check((value) => value.position === undefined || value.fileId !== undefined),
  ),
  v.pipe(
    objectSchema({
      type: v.literal('novel'),
      identifier: entryIdentifierSchema,
      ...novelSelection,
      position: v.exactOptional(readingPositionSchema),
    }),
    v.check((value) => value.position === undefined || value.fileId !== undefined),
  ),
])
const commonClues = {
  name: optionalId,
  originalName: optionalId,
  externalIdentities: v.exactOptional(
    v.pipe(v.strictTuple([externalIdentitySchema]), v.readonly()),
  ),
}
const workClues = objectSchema({ ...commonClues, releaseDate: v.exactOptional(partialDateSchema) })
const personClues = objectSchema({ ...commonClues, birthDate: v.exactOptional(partialDateSchema) })
const organizationClues = objectSchema({
  ...commonClues,
  foundedDate: v.exactOptional(partialDateSchema),
})
const addSchemas = [
  objectSchema({
    type: v.literal('add'),
    entryType: v.picklist(['game', 'anime', 'comic', 'novel']),
    clues: workClues,
    profileId: optionalId,
  }),
  objectSchema({
    type: v.literal('add'),
    entryType: v.picklist(['character', 'person']),
    clues: personClues,
    profileId: optionalId,
  }),
  objectSchema({
    type: v.literal('add'),
    entryType: v.literal('organization'),
    clues: organizationClues,
    profileId: optionalId,
  }),
] as const
const extensionIdSchema = v.pipe(
  v.string(),
  v.check((value) => {
    try {
      parseExtensionId(value)
      return true
    } catch {
      return false
    }
  }),
)
const extensionSchema = objectSchema({
  type: v.literal('extension'),
  extensionId: extensionIdSchema,
  path: v.pipe(
    v.array(
      v.pipe(
        v.string(),
        v.check((value) => value !== '.' && value !== '..'),
      ),
    ),
    v.readonly(),
  ),
  query: v.pipe(
    v.array(v.pipe(v.strictTuple([v.string(), v.string()]), v.readonly())),
    v.readonly(),
  ),
  fragment: v.exactOptional(v.string()),
})
const requestSchema = v.union([
  objectSchema({ type: v.literal('view'), target: viewSchema }),
  objectSchema({ type: v.literal('open'), target: openSchema }),
  ...addSchemas,
  extensionSchema,
])

/** Validate the pure request before formatting or delivery; this never grants an execution context. */
export function parseDeeplinkRequest(input: unknown): DeeplinkRequest {
  const value = parseContract(requestSchema, input, 'deeplink request')
  validateUnicode(value)
  if (
    value.type === 'view' &&
    value.target.type === 'extensions' &&
    value.target.extensionId !== undefined
  ) {
    parseContract(extensionIdSchema, value.target.extensionId, 'extension identity')
  }
  // Exact branch schemas and their cross-field checks establish the explicit public unions above.
  return value as DeeplinkRequest
}

/** Parse one URL, validating raw dot components and UTF-8 before WHATWG normalization can erase them. */
export function parse(input: string): DeeplinkRequest {
  const raw = /^(kisaki|kisaki-dev):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(input)
  if (!raw || input.trim() !== input || /[\r\n\t]/.test(input)) {
    return invalidInput('Invalid application URL.')
  }
  const rawPath = raw[3] ?? ''
  const path = rawPath === '' ? [] : rawPath.slice(1).split('/').map(decodeComponent)
  if (path.some((part) => part === '.' || part === '..')) {
    return invalidInput('Dot path components are not allowed.')
  }
  for (const part of (raw[4]?.slice(1) ?? '').split('&')) {
    const separator = part.indexOf('=')
    decodeComponent((separator < 0 ? part : part.slice(0, separator)).replaceAll('+', ' '))
    if (separator >= 0) {
      decodeComponent(part.slice(separator + 1).replaceAll('+', ' '))
    }
  }
  const fragment = raw[5] === undefined ? undefined : decodeComponent(raw[5].slice(1))
  let url: URL
  try {
    url = new URL(input)
  } catch (cause) {
    throw new ExecutionError(
      { code: 'InvalidInput', message: 'Invalid application URL.' },
      { cause },
    )
  }
  if (
    raw[2] !== url.hostname ||
    url.username ||
    url.password ||
    url.port ||
    !['kisaki:', 'kisaki-dev:'].includes(url.protocol)
  ) {
    return invalidInput('Invalid application URL authority.')
  }
  if (url.hostname === 'extension') {
    return parseDeeplinkRequest({
      type: 'extension',
      extensionId: path[0],
      path: path.slice(1),
      query: [...url.searchParams.entries()],
      ...(fragment === undefined ? {} : { fragment }),
    })
  }
  if (fragment !== undefined) {
    return invalidInput('Native application URLs do not accept fragments.')
  }
  const parameters: Record<string, unknown> = {}
  for (const [key, value] of url.searchParams) {
    if (
      Object.hasOwn(parameters, key) ||
      value === '' ||
      ['type', 'identifier', 'id', 'target', 'clues'].includes(key)
    ) {
      return invalidInput('Invalid or repeated native URL parameter.')
    }
    Object.defineProperty(parameters, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  if (url.hostname === 'add' && path.length === 0) {
    return parseAddParameters(parameters)
  }
  if ((url.hostname !== 'view' && url.hostname !== 'open') || path.length === 0) {
    return invalidInput('Unknown application URL target.')
  }
  const target = path[0]
  if (entryTypes.some((type) => type === target)) {
    const identifier = path.length === 1 ? undefined : parseIdentifierPath(path.slice(1))
    if (Object.hasOwn(parameters, 'position')) {
      parameters.position = parseJsonParameter(parameters.position)
    }
    return parseDeeplinkRequest({
      type: url.hostname,
      target: { type: target, ...(identifier === undefined ? {} : { identifier }), ...parameters },
    })
  }
  if (url.hostname !== 'view') {
    return invalidInput('Only works can be opened.')
  }
  if (['collection', 'tag', 'note'].includes(target ?? '')) {
    if (path.length > 2) {
      return invalidInput('Invalid organizer URL path.')
    }
    return parseDeeplinkRequest({
      type: 'view',
      target: { type: target, ...(path.length === 2 ? { id: path[1] } : {}), ...parameters },
    })
  }
  if (path.length !== 1) {
    return invalidInput('Invalid native view path.')
  }
  return parseDeeplinkRequest({
    type: 'view',
    target: { type: target === 'metadata-profiles' ? 'metadataProfiles' : target, ...parameters },
  })
}

/** Format one legal request using one encoding pass per component; the default scheme is kisaki. */
export function format(input: DeeplinkRequest, scheme: DeeplinkScheme = 'kisaki'): string {
  const request = parseDeeplinkRequest(input)
  parseContract(v.picklist(['kisaki', 'kisaki-dev']), scheme, 'application scheme')
  try {
    if (request.type === 'extension') {
      const path = [request.extensionId, ...request.path].map(encodeURIComponent).join('/')
      const query = new URLSearchParams(
        request.query.map(([name, value]): [string, string] => [name, value]),
      ).toString()
      return `${scheme}://extension/${path}${query ? `?${query}` : ''}${request.fragment === undefined ? '' : `#${encodeURIComponent(request.fragment)}`}`
    }
    if (request.type === 'add') {
      const query = new URLSearchParams({ entryType: request.entryType })
      for (const [name, value] of Object.entries(request.clues)) {
        if (name !== 'externalIdentities') {
          query.set(name, typeof value === 'string' ? value : JSON.stringify(value))
        }
      }
      const identity = request.clues.externalIdentities?.[0]
      if (identity) {
        query.set('source', identity.source)
        query.set('sourceId', identity.sourceId)
      }
      if (request.profileId !== undefined) {
        query.set('profileId', request.profileId)
      }
      return `${scheme}://add?${query.toString()}`
    }
    const target = request.target
    const path = [target.type === 'metadataProfiles' ? 'metadata-profiles' : target.type]
    const query = new URLSearchParams()
    for (const [name, value] of Object.entries(target)) {
      if (name === 'identifier') {
        const identifier = parseContract(entryIdentifierSchema, value, 'entry identifier')
        path.push(
          ...(identifier.type === 'local'
            ? ['local', identifier.id]
            : ['external', identifier.source, identifier.sourceId]),
        )
      } else if (name === 'id') {
        path.push(parseContract(nonemptyStringSchema, value, 'organizer identity'))
      } else if (name !== 'type') {
        query.set(
          name,
          name === 'position'
            ? JSON.stringify(value)
            : parseContract(v.string(), value, 'URL parameter'),
        )
      }
    }
    const encodedQuery = query.toString()
    return `${scheme}://${request.type}/${path.map(encodeURIComponent).join('/')}${encodedQuery ? `?${encodedQuery}` : ''}`
  } catch (cause) {
    if (cause instanceof ExecutionError) {
      throw cause
    }
    throw new ExecutionError(
      { code: 'InvalidInput', message: 'The application URL cannot be encoded.' },
      { cause },
    )
  }
}

function decodeComponent(value: string): string {
  try {
    const decoded = decodeURIComponent(value)
    encodeURIComponent(decoded)
    return decoded
  } catch (cause) {
    throw new ExecutionError(
      { code: 'InvalidInput', message: 'Invalid URL component encoding.' },
      { cause },
    )
  }
}

function validateUnicode(value: unknown): void {
  if (typeof value === 'string') {
    try {
      encodeURIComponent(value)
    } catch (cause) {
      throw new ExecutionError(
        { code: 'InvalidInput', message: 'Invalid URL text encoding.' },
        { cause },
      )
    }
  } else if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) {
      validateUnicode(child)
    }
  }
}

function parseIdentifierPath(path: readonly string[]): EntryIdentifier {
  if (path[0] === 'local' && path.length === 2) {
    return parseContract(entryIdentifierSchema, { type: 'local', id: path[1] }, 'entry identifier')
  }
  if (path[0] === 'external' && path.length === 3) {
    return parseContract(
      entryIdentifierSchema,
      { type: 'external', source: path[1], sourceId: path[2] },
      'entry identifier',
    )
  }
  return invalidInput('Invalid entry identifier path.')
}

function parseJsonParameter(value: unknown): unknown {
  if (typeof value !== 'string') {
    return invalidInput('Invalid JSON URL parameter.')
  }
  try {
    return JSON.parse(value) as unknown
  } catch (cause) {
    throw new ExecutionError(
      { code: 'InvalidInput', message: 'Invalid JSON URL parameter.' },
      { cause },
    )
  }
}

function parseAddParameters(parameters: Record<string, unknown>): DeeplinkRequest {
  const { entryType, profileId, source, sourceId, ...fields } = parameters
  const clues: Record<string, unknown> = { ...fields }
  if ((source === undefined) !== (sourceId === undefined)) {
    return invalidInput('A complete external identity is required.')
  }
  if (source !== undefined) {
    clues.externalIdentities = [
      parseContract(externalIdentitySchema, { source, sourceId }, 'external identity'),
    ]
  }
  for (const name of ['releaseDate', 'birthDate', 'foundedDate']) {
    if (Object.hasOwn(clues, name)) {
      clues[name] = parseJsonParameter(clues[name])
    }
  }
  return parseDeeplinkRequest({
    type: 'add',
    entryType,
    clues,
    ...(profileId === undefined ? {} : { profileId }),
  })
}
