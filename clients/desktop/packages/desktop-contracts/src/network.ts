/** @fileoverview Defines host HTTP consumption and explicit proxy values without exposing Electron networking objects. */

import type { ErrorSummary } from './errors'
import type { Listener, Disposable } from './operations'
import { parseValue, text, id } from './validation'
import { DesktopError } from './errors'
import * as v from 'valibot'

/**
 * Single HTTP, HTTPS or SOCKS5 proxy address with an explicit port.
 *
 * Credentials are supplied separately as protected values.
 */
export type ProxyEndpoint = string

/** Plaintext proxy credentials accepted at the protected native write boundary. */
export interface ProxyCredentials {
  readonly username: string
  readonly password: string
}

/** Opaque revision identifying saved proxy credentials in ordinary read projections. */
export interface ProxyCredentialState {
  readonly revision: string
}

/** Saved route selection, manual proxy settings and protected-credential revision. */
export interface NetworkPreferences {
  readonly mode: 'system' | 'direct' | 'manual'
  readonly endpoint: ProxyEndpoint | null
  readonly bypassRules: string
  readonly credentials: ProxyCredentialState | null
}

/**
 * Readiness of the host network route after applying saved preferences.
 *
 * A failed apply blocks networking instead of silently retaining an old route or switching to
 * direct access.
 */
export type NetworkState =
  | { readonly status: 'ready' }
  | { readonly status: 'applying' }
  | { readonly status: 'failed'; readonly error: ErrorSummary }

/** Host HTTP request options with explicit body encoding, redirect policy and cancellation. */
export interface NetworkFetchOptions {
  /** Defaults to GET; the caller supplies any method required by its explicitly encoded body. */
  readonly method?: string
  readonly headers?: NonNullable<RequestInit['headers']>
  readonly body?: Exclude<RequestInit['body'], undefined>
  readonly signal?: AbortSignal
  /** Defaults to follow; credential-bearing source requests explicitly choose error. */
  readonly redirect?: 'follow' | 'error'
}

/**
 * HTTP response metadata and a body that can be consumed once.
 *
 * Callers cancel unused streams to release them. This surface exposes no clone operation and does
 * not promise a native Response instance.
 */
export interface NetworkResponse {
  readonly url: string
  readonly redirected: boolean
  readonly status: number
  readonly statusText: string
  readonly ok: boolean
  readonly headers: Headers

  readonly body: ReadableStream<Uint8Array> | null
  readonly bodyUsed: boolean

  /** Consumes the body once as text, rejecting on stream failure or cancellation. */
  text(): Promise<string>

  /**
   * Consumes the body once and parses JSON, rejecting invalid JSON, stream failure or cancellation.
   */
  json(): Promise<unknown>

  /** Consumes the body once into an owned buffer, rejecting on stream failure or cancellation. */
  arrayBuffer(): Promise<ArrayBuffer>

  /** Consumes the body once into owned bytes, rejecting on stream failure or cancellation. */
  bytes(): Promise<Uint8Array<ArrayBuffer>>

  /** Consumes the body once as a Blob, rejecting on stream failure or cancellation. */
  blob(): Promise<Blob>

  /**
   * Consumes the body once as form data according to its content type.
   *
   * Unsupported or invalid form data, stream failure and cancellation reject the read.
   */
  formData(): Promise<FormData>
}

/** Host HTTP access through the applied route and observation of route readiness. */
export interface NetworkApi {
  /**
   * Starts an HTTP request and resolves when response headers arrive.
   *
   * HTTP error statuses remain normal responses. Later cancellation fails outstanding body reads.
   */
  fetch(url: string | URL, options?: NetworkFetchOptions): Promise<NetworkResponse>

  /** Reads whether the saved network choice has been applied successfully. */
  getState(): Promise<NetworkState>

  /**
   * Delivers current readiness and subsequent changes and returns the observation lifetime.
   *
   * Releasing observation leaves requests running.
   */
  observe(listener: Listener<NetworkState>): Disposable
}

/**
 * Parses and serializes an absolute HTTP(S) URL using the native URL implementation.
 *
 * Rejects embedded credentials, surrounding whitespace and control characters.
 */
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

/**
 * Parses a single supported proxy endpoint and returns its canonical host and explicit port.
 *
 * Rejects credentials, resource paths, query strings, fragments and invalid ports.
 */
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

/** Parses the username and password supplied to a protected proxy-credential write. */
export function parseProxyCredentials(input: unknown): ProxyCredentials {
  return parseValue(
    v.strictObject({ username: text, password: text }),
    input,
    'Invalid proxy credentials',
  )
}

/**
 * Parses absent credentials or their saved opaque revision.
 *
 * The revision exposes no plaintext and does not establish successful decryption.
 */
export function parseProxyCredentialState(input: unknown): ProxyCredentialState | null {
  return parseValue(
    v.nullable(v.strictObject({ revision: id })),
    input,
    'Invalid proxy credential state',
  )
}

/**
 * Parses complete network preferences and checks manual proxy requirements.
 *
 * Manual mode requires an endpoint and rejects credentials for SOCKS5 proxies.
 */
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
