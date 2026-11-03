/** @fileoverview Defines host HTTP consumption and explicit proxy values without exposing Electron networking objects. */

import * as v from 'valibot'
import { DesktopError } from './errors'
import type { ErrorSummary } from './errors'
import type { Disposable, Listener } from './operations'
import { id, parseValue, text } from './validation'

/** A single HTTP/HTTPS/SOCKS5 endpoint; credentials are separate protected values, never URL user information. */
export type ProxyEndpoint = string

export interface ProxyCredentials {
  readonly username: string
  readonly password: string
}

export interface ProxyCredentialState {
  readonly revision: string
}

export interface NetworkPreferences {
  readonly mode: 'system' | 'direct' | 'manual'
  readonly endpoint: ProxyEndpoint | null
  readonly bypassRules: string
  readonly credentials: ProxyCredentialState | null
}

/** Saved choice and readiness differ; a failed apply prevents networking instead of silently using an old/direct route. */
export type NetworkState =
  | { readonly status: 'ready' }
  | { readonly status: 'applying' }
  | { readonly status: 'failed'; readonly error: ErrorSummary }

export interface NetworkFetchOptions {
  readonly method?: string
  readonly headers?: NonNullable<RequestInit['headers']>
  readonly body?: Exclude<RequestInit['body'], undefined>
  readonly signal?: AbortSignal
  readonly redirect?: 'follow' | 'error'
}

/** A single-consumption body. Cancel unused streams to release; no clone and no promise of a native Response instance. */
export interface NetworkResponse {
  readonly url: string
  readonly redirected: boolean
  readonly status: number
  readonly statusText: string
  readonly ok: boolean
  readonly headers: Headers

  readonly body: ReadableStream<Uint8Array> | null
  readonly bodyUsed: boolean

  text(): Promise<string>
  json(): Promise<unknown>
  arrayBuffer(): Promise<ArrayBuffer>
  bytes(): Promise<Uint8Array<ArrayBuffer>>
  blob(): Promise<Blob>
  formData(): Promise<FormData>
}

export interface NetworkApi {
  /** Resolve at response headers. Later cancellation fails outstanding body reads; HTTP error statuses remain normal responses. */
  fetch(url: string | URL, options?: NetworkFetchOptions): Promise<NetworkResponse>

  getState(): Promise<NetworkState>
  observe(listener: Listener<NetworkState>): Disposable
}

/** Validate and canonicalize an absolute HTTP(S) address without changing its encoded path/query or following redirects. */
export function parseHttpUrl(input: unknown): string {
  const value = parseValue(text, input, 'Invalid HTTP URL')
  try {
    const url = new URL(value)
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      value.trim() !== value ||
      [...value].some(
        (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    ) {
      throw new TypeError('Invalid HTTP address')
    }

    return url.href
  } catch (cause) {
    throw new DesktopError('InvalidInput', 'Invalid HTTP URL', { cause })
  }
}

/** Reject PAC expressions, URL credentials, paths and multiple endpoints before any proxy execution. */
export function parseProxyEndpoint(input: unknown): ProxyEndpoint {
  const value = parseValue(text, input, 'Invalid proxy endpoint')
  try {
    const url = new URL(value)
    if (
      !['http:', 'https:', 'socks5:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      (url.pathname !== '' && url.pathname !== '/') ||
      url.search ||
      url.hash ||
      value.trim() !== value ||
      [...value].some(
        (character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
      )
    ) {
      throw new TypeError('Invalid proxy endpoint')
    }

    const defaultPorts: Readonly<Record<string, number>> = {
      'http:': 80,
      'https:': 443,
      'socks5:': 1080,
    }
    const port = url.port === '' ? defaultPorts[url.protocol]! : Number(url.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new TypeError('Invalid proxy port')
    }

    return `${url.protocol}//${url.hostname}:${port}`
  } catch (cause) {
    throw new DesktopError('InvalidInput', 'Invalid proxy endpoint', { cause })
  }
}

/** Credential content is accepted only by protected native writes and is never part of an ordinary read projection. */
export function parseProxyCredentials(input: unknown): ProxyCredentials {
  return parseValue(
    v.strictObject({ username: text, password: text }),
    input,
    'Invalid proxy credentials',
  )
}

export function parseProxyCredentialState(input: unknown): ProxyCredentialState | null {
  return parseValue(
    v.nullable(v.strictObject({ revision: id })),
    input,
    'Invalid proxy credential state',
  )
}

/** Strict complete configuration; manual without an endpoint and unsupported SOCKS5 authentication cannot execute. */
export function parseNetworkPreferences(input: unknown): NetworkPreferences {
  const value = parseValue(
    v.strictObject({
      mode: v.picklist(['system', 'direct', 'manual']),
      endpoint: v.nullable(v.pipe(v.unknown(), v.transform(parseProxyEndpoint))),
      bypassRules: text,
      credentials: v.pipe(v.unknown(), v.transform(parseProxyCredentialState)),
    }),
    input,
    'Invalid network preferences',
  )
  if (
    value.mode === 'manual' &&
    (value.endpoint === null ||
      (value.endpoint.startsWith('socks5:') && value.credentials !== null))
  ) {
    throw new DesktopError(
      'InvalidInput',
      'Manual proxy configuration is incomplete or authentication is unsupported',
    )
  }

  return value
}
