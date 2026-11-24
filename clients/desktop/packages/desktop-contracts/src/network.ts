import type { Listener, Disposable } from './operations'
import { fromParser, asciiControl, parseValue, text, id } from './validation'
import { DesktopError, type ErrorSummary } from './errors'
import * as v from 'valibot'

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
  fetch(url: string | URL, options?: NetworkFetchOptions): Promise<NetworkResponse>

  getState(): Promise<NetworkState>

  observe(listener: Listener<NetworkState>): Disposable
}

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
      asciiControl.test(value)
    ) {
      throw new TypeError('Invalid HTTP address')
    }

    return url.href
  } catch (cause) {
    throw new DesktopError('InvalidInput', 'Invalid HTTP URL', { cause })
  }
}

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
      value.includes(' ') ||
      asciiControl.test(value)
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

export function manualProxyIssue(
  mode: NetworkPreferences['mode'],
  endpoint: ProxyEndpoint | null,
  authenticated: boolean,
) {
  if (mode !== 'manual') {
    return null
  }
  if (endpoint === null) {
    return 'endpoint'
  }
  return authenticated && endpoint.startsWith('socks5:') ? 'credentials' : null
}

export function parseNetworkPreferences(input: unknown): NetworkPreferences {
  const value = parseValue(
    v.strictObject({
      mode: v.picklist(['system', 'direct', 'manual']),
      endpoint: v.nullable(fromParser(parseProxyEndpoint)),
      bypassRules: text,
      credentials: fromParser(parseProxyCredentialState),
    }),
    input,
    'Invalid network preferences',
  )
  if (manualProxyIssue(value.mode, value.endpoint, value.credentials !== null)) {
    throw new DesktopError(
      'InvalidInput',
      'Manual proxy configuration is incomplete or authentication is unsupported',
    )
  }

  return value
}
