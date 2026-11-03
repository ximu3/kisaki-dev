/** @fileoverview Parses and formats the closed native links and lossless owner-scoped extension links using WHATWG URL semantics. */

import * as v from 'valibot'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { DesktopError } from './errors'
import { parseStrictJson } from './json'
import type { ExecutionContext, Registration } from './operations'
import { entryTypes, isWorkType, parseExternalIdentity, workTypes } from './library/catalog'
import type { EntryType, ExternalIdentity, WorkType } from './library/catalog'
import { parseIdentificationClues } from './metadata/fields'
import type { IdentificationClues } from './metadata/fields'
import {
  parseAnimeOpenInput,
  parseComicOpenInput,
  parseGameOpenInput,
  parseNovelOpenInput,
} from './sessions'
import type { AnimeOpenInput, ComicOpenInput, GameOpenInput, NovelOpenInput } from './sessions'
import { entrySelectionEntries, parseEntryIdentifier, parseNativeViewTarget } from './ui/navigation'
import type { EntryIdentifier, NativeViewTarget } from './ui/navigation'
import { id, omitFields, parseExternalValue, parseValue, readRecord, text } from './validation'

export type DeeplinkScheme = 'kisaki' | 'kisaki-dev'
export type PublicViewTarget =
  | Extract<
      NativeViewTarget,
      {
        type:
          | 'library'
          | 'entries'
          | 'entry'
          | 'collection'
          | 'tag'
          | 'note'
          | 'tasks'
          | 'scanner'
          | 'metadataProfiles'
          | 'extensions'
      }
    >
  | { readonly type: 'preferences' }
type WithoutRoot<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export interface DeeplinkOpenInputMap {
  readonly game: WithoutRoot<GameOpenInput, 'gameId'>
  readonly anime: WithoutRoot<AnimeOpenInput, 'animeId'>
  readonly comic: WithoutRoot<ComicOpenInput, 'comicId'>
  readonly novel: WithoutRoot<NovelOpenInput, 'novelId'>
}
/** All selectors apply together; external identity resolves the root only, never a local child/file identity. */
export type DeeplinkOpenTarget = {
  [K in WorkType]: {
    readonly workType: K
    readonly identifier: EntryIdentifier
  } & DeeplinkOpenInputMap[K]
}[WorkType]
export type DeeplinkAddInput = {
  [K in EntryType]: {
    readonly entryType: K
    readonly clues: Omit<IdentificationClues<K>, 'externalIdentities'> & {
      readonly externalIdentities?: readonly [ExternalIdentity]
    }
    readonly profileId?: string
  }
}[EntryType]
/** Path excludes extensionId; empty components, ordered repeated query keys and an explicitly empty fragment are meaningful. */
export interface ExtensionDeeplinkRequest {
  readonly path: readonly string[]
  readonly query: readonly (readonly [name: string, value: string])[]
  readonly fragment?: string
}
export type DeeplinkRequest = { readonly scheme: DeeplinkScheme } & (
  | { readonly type: 'view'; readonly target: PublicViewTarget }
  | { readonly type: 'open'; readonly target: DeeplinkOpenTarget }
  | { readonly type: 'add'; readonly input: DeeplinkAddInput }
  | ({ readonly type: 'extension'; readonly extensionId: string } & ExtensionDeeplinkRequest)
)
export interface DeeplinkApi {
  /** One live handler per instance. Resolve only after the requested business operation and its necessary cleanup finish. */
  register(
    handler: (request: ExtensionDeeplinkRequest, execution: ExecutionContext) => Promise<void>,
  ): Promise<Registration<{ readonly extensionId: string }>>
}

const publicTypes = [
  'library',
  'entries',
  'entry',
  'collection',
  'tag',
  'note',
  'tasks',
  'scanner',
  'metadataProfiles',
  'preferences',
  'extensions',
]
const schemeSchema = v.picklist(['kisaki', 'kisaki-dev'])
const extensionIdentity = v.pipe(
  v.unknown(),
  v.transform((value) => parseExternalValue(parseId, value, 'Invalid extension identity')),
)
const openSelectors = {
  game: ['launchConfigId'],
  anime: ['episodeId', 'extraId', 'fileId', 'position'],
  comic: ['volumeId', 'chapterId', 'fileId', 'position'],
  novel: ['volumeId', 'fileId', 'position'],
} as const
function invalid(message = 'Invalid application link'): never {
  throw new DesktopError('InvalidInput', message)
}
function decode(value: string, query = false): string {
  try {
    return decodeURIComponent(query ? value.replaceAll('+', ' ') : value)
  } catch (cause) {
    throw new DesktopError('InvalidInput', 'Invalid link component encoding', { cause })
  }
}
function parsePublicView(input: unknown): PublicViewTarget {
  const target = parseNativeViewTarget(input)
  if (
    !publicTypes.includes(target.type) ||
    (target.type === 'preferences' && target.key !== undefined)
  ) {
    invalid('The native target has no public link')
  }
  return target as PublicViewTarget
}
function parseOpenTarget(input: unknown): DeeplinkOpenTarget {
  const record = readRecord(input)
  const workType = parseValue(v.picklist(workTypes), record.workType)
  const fields = Object.fromEntries(
    openSelectors[workType].map((key) => [key, v.exactOptional(v.unknown())]),
  )
  const target = parseValue(
    v.strictObject({
      workType: v.literal(workType),
      identifier: v.pipe(v.unknown(), v.transform(parseEntryIdentifier)),
      ...fields,
    }),
    input,
  )
  const { identifier } = target
  const selection = omitFields(target, ['identifier', 'workType'])
  // Reuse actual session selector checks; the placeholder identity is never returned or used for a lookup.
  switch (workType) {
    case 'game':
      return {
        workType,
        identifier,
        ...omitFields(parseGameOpenInput({ gameId: 'root', ...selection }), ['gameId']),
      }
    case 'anime':
      return {
        workType,
        identifier,
        ...omitFields(parseAnimeOpenInput({ animeId: 'root', ...selection }), ['animeId']),
      }
    case 'comic':
      return {
        workType,
        identifier,
        ...omitFields(parseComicOpenInput({ comicId: 'root', ...selection }), ['comicId']),
      }
    case 'novel':
      return {
        workType,
        identifier,
        ...omitFields(parseNovelOpenInput({ novelId: 'root', ...selection }), ['novelId']),
      }
  }
}
function parseAddInput(input: unknown): DeeplinkAddInput {
  const record = readRecord(input)
  const entryType = parseValue(v.picklist(entryTypes), record.entryType)
  const result = parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      clues: v.pipe(
        v.unknown(),
        v.transform((value) => parseIdentificationClues(entryType, value)),
      ),
      profileId: v.exactOptional(id),
    }),
    input,
  )
  const identities = result.clues.externalIdentities
  if (
    (identities && identities.length !== 1) ||
    (!result.clues.name && !result.clues.originalName && !identities?.length)
  ) {
    invalid('An add link requires a useful name or one complete external identity')
  }
  return result as DeeplinkAddInput
}
/** Validate the structured request before formatting; host interaction permission is never accepted as link data. */
export function parseRequest(input: unknown): DeeplinkRequest {
  const value = parseValue(
    v.variant('type', [
      v.strictObject({
        scheme: schemeSchema,
        type: v.literal('view'),
        target: v.pipe(v.unknown(), v.transform(parsePublicView)),
      }),
      v.strictObject({
        scheme: schemeSchema,
        type: v.literal('open'),
        target: v.pipe(v.unknown(), v.transform(parseOpenTarget)),
      }),
      v.strictObject({
        scheme: schemeSchema,
        type: v.literal('add'),
        input: v.pipe(v.unknown(), v.transform(parseAddInput)),
      }),
      v.strictObject({
        scheme: schemeSchema,
        type: v.literal('extension'),
        extensionId: extensionIdentity,
        path: v.array(text),
        query: v.array(v.tuple([text, text])),
        fragment: v.exactOptional(text),
      }),
    ]),
    input,
    'Invalid application link request',
  )
  if (value.type === 'extension' && value.path.some((part) => part === '.' || part === '..')) {
    invalid('Dot path components are not allowed')
  }
  return value
}

function readIdentifier(parts: readonly string[]): EntryIdentifier {
  if (parts[0] === 'local' && parts.length === 2) {
    return parseEntryIdentifier({ type: 'local', id: parts[1] })
  }
  if (parts[0] === 'external' && parts.length === 3) {
    return parseEntryIdentifier({ type: 'external', source: parts[1], sourceId: parts[2] })
  }
  return invalid('Invalid entry link address')
}
function singleQuery(query: readonly (readonly [string, string])[]): Record<string, string> {
  const entries = new Map<string, string>()
  for (const [key, value] of query) {
    if (entries.has(key) || value === '') {
      invalid('Native link parameters must be distinct and nonempty')
    }
    entries.set(key, value)
  }
  return Object.fromEntries(entries)
}
function requireKeys(values: object, allowed: readonly string[]): void {
  if (Object.keys(values).some((key) => !allowed.includes(key))) {
    invalid('Unknown native link parameter')
  }
}

/** Decode every component once, checking raw dot segments before URL normalization can change the target. */
export function parse(input: string): DeeplinkRequest {
  const source = parseValue(text, input, 'Invalid application link')
  if (
    source.trim() !== source ||
    [...source].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 || character === '\\',
    )
  ) {
    invalid()
  }
  const raw = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#([\s\S]*))?$/i.exec(
    source,
  )
  if (!raw || raw[0] !== source) {
    invalid()
  }
  const scheme = parseValue(schemeSchema, raw[1]!.toLowerCase())
  let url: URL
  try {
    url = new URL(source)
  } catch (cause) {
    throw new DesktopError('InvalidInput', 'Invalid application URL', { cause })
  }
  if (
    url.username ||
    url.password ||
    url.port ||
    !['view', 'open', 'add', 'extension'].includes(url.hostname) ||
    raw[2] !== url.hostname
  ) {
    invalid('Invalid application link authority')
  }
  const rawPath = raw[3]!
  const path =
    rawPath === ''
      ? []
      : rawPath
          .slice(1)
          .split('/')
          .map((part) => decode(part))
  if (path.some((part) => part === '.' || part === '..')) {
    invalid('Dot path components are not allowed')
  }
  if (raw[4] !== undefined) {
    for (const pair of raw[4].split('&')) {
      for (const component of pair.split('=')) {
        decode(component, true)
      }
    }
  }
  const query = [...url.searchParams] as [string, string][]
  const fragment = raw[5] === undefined ? undefined : decode(raw[5])
  if (url.hostname === 'extension') {
    const extensionId = parseExternalValue(parseId, path[0], 'Invalid extension link identity')
    return parseRequest({
      scheme,
      type: 'extension',
      extensionId,
      path: path.slice(1),
      query,
      ...(fragment === undefined ? {} : { fragment }),
    })
  }
  if (fragment !== undefined) {
    invalid('Native links do not accept a fragment')
  }
  const parameters = singleQuery(query)
  if (url.hostname === 'add') {
    if (path.length > 0) {
      invalid('Add links do not have a path')
    }
    const entryType = parseValue(v.picklist(entryTypes), parameters.entryType)
    let dateField: 'birthDate' | 'releaseDate' | 'foundedDate' = 'birthDate'
    if (isWorkType(entryType)) {
      dateField = 'releaseDate'
    } else if (entryType === 'organization') {
      dateField = 'foundedDate'
    }
    requireKeys(parameters, [
      'entryType',
      'source',
      'sourceId',
      'name',
      'originalName',
      dateField,
      'profileId',
    ])
    if (Object.hasOwn(parameters, 'source') !== Object.hasOwn(parameters, 'sourceId')) {
      invalid('External identity parameters must occur together')
    }
    const date = parameters[dateField]
    const clues = {
      ...(parameters.name === undefined ? {} : { name: parameters.name }),
      ...(parameters.originalName === undefined ? {} : { originalName: parameters.originalName }),
      ...(date === undefined ? {} : { [dateField]: parseStrictJson(date) }),
      ...(parameters.source === undefined
        ? {}
        : {
            externalIdentities: [
              parseExternalIdentity({ source: parameters.source, sourceId: parameters.sourceId }),
            ],
          }),
    }
    return parseRequest({
      scheme,
      type: 'add',
      input: {
        entryType,
        clues,
        ...(parameters.profileId === undefined ? {} : { profileId: parameters.profileId }),
      },
    })
  }
  if (url.hostname === 'open') {
    const workType = parseValue(v.picklist(workTypes), path[0])
    requireKeys(parameters, openSelectors[workType])
    return parseRequest({
      scheme,
      type: 'open',
      target: {
        workType,
        identifier: readIdentifier(path.slice(1)),
        ...parameters,
        ...(parameters.position === undefined
          ? {}
          : { position: parseStrictJson(parameters.position) }),
      },
    })
  }
  const kind = path[0]
  if (entryTypes.some((type) => type === kind)) {
    const entryType = kind as EntryType
    if (path.length === 1) {
      requireKeys(parameters, [])
      return { scheme, type: 'view', target: { type: 'entries', entryType } }
    }
    requireKeys(parameters, Object.keys(entrySelectionEntries[entryType]))
    return parseRequest({
      scheme,
      type: 'view',
      target: {
        type: 'entry',
        entryType,
        identifier: readIdentifier(path.slice(1)),
        ...parameters,
      },
    })
  }
  if (kind === 'collection' || kind === 'tag' || kind === 'note') {
    requireKeys(parameters, [])
    if (path.length > 2) {
      invalid()
    }
    return parseRequest({
      scheme,
      type: 'view',
      target: { type: kind, ...(path.length === 2 ? { id: path[1] } : {}) },
    })
  }
  if (path.length !== 1) {
    invalid()
  }
  if (kind === 'library' || kind === 'preferences') {
    requireKeys(parameters, [])
    return { scheme, type: 'view', target: { type: kind } }
  }
  const aliases = {
    tasks: 'tasks',
    scanner: 'scanner',
    'metadata-profiles': 'metadataProfiles',
    extensions: 'extensions',
  } as const
  if (kind && Object.hasOwn(aliases, kind)) {
    const allowed = {
      tasks: ['runId'],
      scanner: ['configId', 'runId'],
      'metadata-profiles': ['profileId'],
      extensions: ['extensionId', 'pageId'],
    }
    requireKeys(parameters, allowed[kind as keyof typeof allowed])
    return parseRequest({
      scheme,
      type: 'view',
      target: { type: aliases[kind as keyof typeof aliases], ...parameters },
    })
  }
  return invalid('Unknown native view link')
}

function address(identifier: EntryIdentifier): string[] {
  return identifier.type === 'local'
    ? ['local', identifier.id]
    : ['external', identifier.source, identifier.sourceId]
}
/** Encode each path/value once. Formatting performs no lookup, defaults selection, installation or implicit profile choice. */
export function format(input: DeeplinkRequest): string {
  const request = parseRequest(input)
  let path: readonly string[]
  let query: readonly (readonly [string, string])[] = []
  let fragment: string | undefined
  if (request.type === 'extension') {
    path = [request.extensionId, ...request.path]
    query = request.query
    fragment = request.fragment
  } else if (request.type === 'open') {
    const { workType, identifier, ...selection } = request.target
    path = [workType, ...address(identifier)]
    query = Object.entries(selection).map(([key, value]) => [
      key,
      key === 'position' ? JSON.stringify(value) : String(value),
    ])
  } else if (request.type === 'add') {
    path = []
    const { entryType, clues, profileId } = request.input
    const values: [string, string][] = [['entryType', entryType]]
    for (const [key, value] of Object.entries(clues)) {
      if (key === 'externalIdentities') {
        const identity = clues.externalIdentities![0]
        values.push(['source', identity.source], ['sourceId', identity.sourceId])
      } else {
        values.push([key, typeof value === 'string' ? value : JSON.stringify(value)])
      }
    }
    if (profileId !== undefined) {
      values.push(['profileId', profileId])
    }
    query = values
  } else {
    const target = request.target
    if (target.type === 'entry') {
      path = [target.entryType, ...address(target.identifier)]
      query = Object.entries(omitFields(target, ['type', 'entryType', 'identifier'])).map(
        ([key, value]) => [key, String(value)],
      )
    } else if (target.type === 'entries') {
      path = [target.entryType]
    } else if (target.type === 'collection' || target.type === 'tag' || target.type === 'note') {
      path = target.id === undefined ? [target.type] : [target.type, target.id]
    } else {
      const { type, ...selection } = target
      path = [type === 'metadataProfiles' ? 'metadata-profiles' : type]
      query = Object.entries(selection).map(([key, value]) => [key, String(value)])
    }
  }
  if (path.some((part) => part === '.' || part === '..')) {
    invalid('Dot path components are not allowed')
  }
  const parameters = new URLSearchParams(query.map(([key, value]) => [key, value])).toString()
  return `${request.scheme}://${request.type}${path.length ? `/${path.map(encodeURIComponent).join('/')}` : ''}${parameters ? `?${parameters}` : ''}${fragment === undefined ? '' : `#${encodeURIComponent(fragment)}`}`
}
