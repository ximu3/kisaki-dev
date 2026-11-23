import type { ExecutionContext, Registration } from './operations'
import * as v from 'valibot'
import {
  fromParser,
  asciiControl,
  parseExternalValue,
  parseRecord,
  parseValue,
  omitFields,
  id,
  text,
} from './validation'
import { parseId } from '@kisaki3/extension-distribution/metadata'
import { DesktopError } from './errors'
import {
  parseNativeViewTarget,
  parseEntryIdentifier,
  entrySelectionEntries,
  type NativeViewTarget,
  type EntryIdentifier,
} from './ui/navigation'
import {
  workTypes,
  entryTypes,
  isWorkType,
  type WorkType,
  type EntryType,
  type ExternalIdentity,
} from './library/catalog'
import {
  openSelectionEntries,
  openTargetSchema,
  type GameOpenInput,
  type AnimeOpenInput,
  type ComicOpenInput,
  type NovelOpenInput,
} from './sessions/targets'
import { parseIdentificationClues, type IdentificationClues } from './metadata/fields'
import { parseStrictJson } from './json'

export type DeeplinkScheme = 'kisaki' | 'kisaki-dev'

/** Native view destinations exposed through public links, with preferences addressed as a whole. */
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

/** An external identity resolves only the root; child and file identities remain local. */
export type DeeplinkOpenTarget = {
  [K in WorkType]: {
    readonly workType: K
    readonly identifier: EntryIdentifier
  } & DeeplinkOpenInputMap[K]
}[WorkType]

/**
 * Clues require a useful name or one complete external identity and can contain at most one
 * external identity.
 */
export type DeeplinkAddInput = {
  [K in EntryType]: {
    readonly entryType: K
    readonly clues: Omit<IdentificationClues<K>, 'externalIdentities'> & {
      readonly externalIdentities?: readonly [ExternalIdentity]
    }
    readonly profileId?: string
  }
}[EntryType]

/**
 * Path excludes the extension ID. Empty path components, ordered repeated query keys and an
 * explicitly empty fragment retain their meaning.
 */
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
  /**
   * Registers the instance's single live link handler and returns its removal handle.
   *
   * The handler resolves after the requested business operation and its necessary cleanup finish.
   */
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

const extensionIdentity = fromParser((value) =>
  parseExternalValue(parseId, value, 'Invalid extension identity'),
)

function invalid(message = 'Invalid application link'): never {
  throw new DesktopError('InvalidInput', message)
}

/** Query components first convert plus signs to spaces. */
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
  const record = parseRecord(input)
  const workType = parseValue(v.picklist(workTypes), record.workType)
  return parseValue(
    openTargetSchema(workType, {
      workType: v.literal(workType),
      identifier: fromParser(parseEntryIdentifier),
    }),
    input,
    'Invalid open link target',
  ) as DeeplinkOpenTarget
}

/** Parses add-link clues, requiring a useful name or exactly one complete external identity. */
function parseAddInput(input: unknown): DeeplinkAddInput {
  const record = parseRecord(input)
  const entryType = parseValue(v.picklist(entryTypes), record.entryType)
  const result = parseValue(
    v.strictObject({
      entryType: v.literal(entryType),
      clues: fromParser((value) => parseIdentificationClues(entryType, value)),
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

/** Interaction options are call context and cannot be carried as link data. */
export function parseRequest(input: unknown): DeeplinkRequest {
  const value = parseValue(
    v.variant('type', [
      v.strictObject({
        scheme: schemeSchema,
        type: v.literal('view'),
        target: fromParser(parsePublicView),
      }),
      v.strictObject({
        scheme: schemeSchema,
        type: v.literal('open'),
        target: fromParser(parseOpenTarget),
      }),
      v.strictObject({
        scheme: schemeSchema,
        type: v.literal('add'),
        input: fromParser(parseAddInput),
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
    return { type: 'local', id: parts[1]! }
  }
  if (parts[0] === 'external' && parts.length === 3) {
    return { type: 'external', source: parts[1]!, sourceId: parts[2]! }
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

function decodeUrl(input: string) {
  const source = parseValue(text, input, 'Invalid application link')
  if (source.trim() !== source || source.includes('\\') || asciiControl.test(source)) {
    invalid()
  }

  const raw = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?(?:#([\s\S]*))?$/i.exec(
    source,
  )
  if (!raw) {
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

  const query = [...url.searchParams]
  const fragment = raw[5] === undefined ? undefined : decode(raw[5])

  return { scheme, authority: url.hostname, path, query, fragment }
}

function parseAddLink(
  scheme: DeeplinkScheme,
  path: readonly string[],
  parameters: Record<string, string>,
): DeeplinkRequest {
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
          externalIdentities: [{ source: parameters.source, sourceId: parameters.sourceId }],
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

function parseOpenLink(
  scheme: DeeplinkScheme,
  path: readonly string[],
  parameters: Record<string, string>,
): DeeplinkRequest {
  const workType = parseValue(v.picklist(workTypes), path[0])
  requireKeys(parameters, Object.keys(openSelectionEntries[workType]))
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

const managementRoutes = {
  tasks: { type: 'tasks', parameters: ['runId'] },
  scanner: { type: 'scanner', parameters: ['configId', 'runId'] },
  'metadata-profiles': { type: 'metadataProfiles', parameters: ['profileId'] },
  extensions: { type: 'extensions', parameters: ['extensionId', 'pageId'] },
} as const

function parseViewLink(
  scheme: DeeplinkScheme,
  path: readonly string[],
  parameters: Record<string, string>,
): DeeplinkRequest {
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

  if (kind && Object.hasOwn(managementRoutes, kind)) {
    const route = managementRoutes[kind as keyof typeof managementRoutes]
    requireKeys(parameters, route.parameters)
    return parseRequest({ scheme, type: 'view', target: { type: route.type, ...parameters } })
  }

  return invalid('Unknown native view link')
}

/**
 * Checks raw dot segments before URL normalization and rejects malformed component encoding.
 * Extension routes preserve ordered query entries, empty path components and explicit fragments.
 */
export function parse(input: string): DeeplinkRequest {
  const { scheme, authority, path, query, fragment } = decodeUrl(input)
  if (authority === 'extension') {
    return parseRequest({
      scheme,
      type: 'extension',
      extensionId: path[0],
      path: path.slice(1),
      query,
      ...(fragment === undefined ? {} : { fragment }),
    })
  }

  if (fragment !== undefined) {
    invalid('Native links do not accept a fragment')
  }

  const parameters = singleQuery(query)
  switch (authority) {
    case 'add':
      return parseAddLink(scheme, path, parameters)
    case 'open':
      return parseOpenLink(scheme, path, parameters)
    default:
      return parseViewLink(scheme, path, parameters)
  }
}

function address(identifier: EntryIdentifier): string[] {
  return identifier.type === 'local'
    ? ['local', identifier.id]
    : ['external', identifier.source, identifier.sourceId]
}

/**
 * Validates and formats a structured request, encoding each path and value once.
 *
 * Formatting performs no lookup, installation or implicit selection.
 */
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
  const pathname = path.length ? '/' + path.map(encodeURIComponent).join('/') : ''
  const search = parameters ? '?' + parameters : ''
  const hash = fragment === undefined ? '' : '#' + encodeURIComponent(fragment)
  return `${request.scheme}://${request.type}${pathname}${search}${hash}`
}
