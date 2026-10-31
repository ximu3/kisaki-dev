/** @fileoverview Defines host HTTP requests and single-use streamed responses through standard web values. */

/** Explicit request options; proxy policy and caller identity belong to the host. */
export interface NetworkFetchOptions {
  readonly method?: string
  readonly headers?: Exclude<ConstructorParameters<typeof Headers>[0], undefined>
  readonly body?: Exclude<RequestInit['body'], undefined>
  readonly signal?: AbortSignal
  readonly redirect?: 'follow' | 'error'
}
/** An owned response body with standard header and stream semantics, consumed once. */
export interface NetworkResponse {
  readonly url: string
  readonly redirected: boolean
  readonly status: number
  readonly statusText: string
  readonly ok: boolean
  readonly headers: Headers
  readonly body: ReadableStream<Uint8Array> | null
  readonly bodyUsed: boolean
  /** Consume the body as decoded text; reading failures remain failures. */
  text(): Promise<string>
  /** Parse the body once; the business owner validates the unknown result. */
  json(): Promise<unknown>
  /** Consume the body as an owned buffer. */
  arrayBuffer(): Promise<ArrayBuffer>
  /** Consume the body as owned bytes. */
  bytes(): Promise<Uint8Array>
  /** Consume the body as a Blob with the response's actual content type. */
  blob(): Promise<Blob>
  /** Parse a supported form response; it does not clone or preserve a second body. */
  formData(): Promise<FormData>
}
/** HTTP(S) requests use application network settings, explicit source credentials, and no automatic Cookie jar. */
export interface NetworkApi {
  /** Resolve after response headers; later cancellation also fails an unfinished body and releases its resources. */
  fetch(url: string | URL, options?: NetworkFetchOptions): Promise<NetworkResponse>
}
