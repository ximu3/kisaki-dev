/** @fileoverview Adapts Chromium requests to single-use Web bodies while retaining cancellation after headers. */

import { net, type Session } from 'electron'
import { Readable } from 'node:stream'
import { addAbortListener } from 'node:events'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseHttpUrl,
  type NetworkFetchOptions,
  type NetworkResponse,
  type ProxyCredentials,
} from '@kisaki3/desktop-contracts/network'

/** Executes one host request without ambient cookies, preserving explicit response headers and stream backpressure. */
export async function request(
  session: Session,
  input: string | URL,
  options: NetworkFetchOptions,
  signal: AbortSignal,
  proxy: { host: string; port: number; credentials: ProxyCredentials } | null,
): Promise<NetworkResponse> {
  signal.throwIfAborted()
  const url = parseHttpUrl(input.toString())
  const headers = new Headers(options.headers)
  const method = options.method ?? 'GET'
  const upload = options.body == null ? null : new Response(options.body)
  if (upload && ['GET', 'HEAD'].includes(method.toUpperCase())) {
    throw new DesktopError('InvalidInput', 'This method cannot send a request body')
  }
  const contentType = upload?.headers.get('content-type')
  if (contentType && !headers.has('content-type')) {
    headers.set('content-type', contentType)
  }
  const req = net.request({
    url,
    method,
    session,
    redirect: 'manual',
    useSessionCookies: false,
    credentials: 'omit',
  })
  let finalUrl = url
  let redirected = false
  let challenged = false
  const received = Promise.withResolvers<NetworkResponse>()
  const reader = upload?.body?.getReader()
  let incoming: Readable | undefined
  /** Aborts the Chromium request and any still-active response body. */
  const abort = () => {
    incoming?.destroy(
      signal.reason instanceof Error
        ? signal.reason
        : new DesktopError('Cancelled', 'The request was cancelled'),
    )
    req.abort()
    received.reject(signal.reason)
  }
  const listener = addAbortListener(signal, abort)
  req.once('close', () => {
    if (!incoming || incoming.destroyed) {
      listener[Symbol.dispose]()
    }
    void reader?.cancel().catch(() => {})
  })
  req.on('error', (cause) =>
    received.reject(new DesktopError('ReadFailed', 'The network request failed', { cause })),
  )
  req.on('login', (challenge, answer) => {
    if (
      proxy &&
      !challenged &&
      challenge.isProxy &&
      challenge.host.toLowerCase() === proxy.host &&
      challenge.port === proxy.port
    ) {
      challenged = true
      answer(proxy.credentials.username, proxy.credentials.password)
    } else {
      answer()
    }
  })
  req.on('redirect', (_status, _method, next) => {
    if (options.redirect === 'error') {
      received.reject(new DesktopError('ReadFailed', 'The server redirected this request'))
      req.abort()
    } else {
      finalUrl = next
      redirected = true
      req.followRedirect()
    }
  })
  req.once('response', (message) => {
    const responseHeaders = new Headers()
    for (let i = 0; i < message.rawHeaders.length; i += 2) {
      responseHeaders.append(message.rawHeaders[i]!, message.rawHeaders[i + 1]!)
    }
    const bodyless = method.toUpperCase() === 'HEAD' || [204, 205, 304].includes(message.statusCode)
    const stream = message as unknown as Readable
    incoming = stream
    stream.once('aborted', () =>
      stream.destroy(new DesktopError('ReadFailed', 'The response stream was interrupted')),
    )
    stream.on('error', () => {})
    stream.once('close', () => {
      listener[Symbol.dispose]()
      if (!stream.readableEnded) {
        req.abort()
      }
    })
    if (bodyless) {
      stream.resume()
    }
    const body = bodyless ? null : responseBody(stream, signal, () => req.abort())
    const response = new Response(body, {
      status: message.statusCode,
      statusText: message.statusMessage,
      headers: responseHeaders,
    })
    received.resolve({
      url: finalUrl,
      redirected,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: response.headers,
      body: response.body,
      /** Reflects consumption of the underlying one-shot body. */
      get bodyUsed() {
        return response.bodyUsed
      },
      /** Consumes the response as decoded text. */
      text: () => response.text(),
      /** Consumes and parses the response as JSON. */
      json: () => response.json() as Promise<unknown>,
      /** Consumes the response into a byte array. */
      bytes: () => response.bytes(),
      /** Consumes the response into an owned buffer. */
      arrayBuffer: () => response.arrayBuffer(),
      /** Consumes the response as a Blob with its content type. */
      blob: () => response.blob(),
      /** Consumes the response using standard form-data decoding. */
      formData: () => response.formData(),
    })
  })
  try {
    headers.forEach((value, key) => req.setHeader(key, value))
    if (!reader) {
      req.end()
    } else {
      req.chunkedEncoding = true
      /** Waits for each Chromium write before pulling the next upload chunk. */
      async function send() {
        for (;;) {
          const { done, value } = await reader!.read()
          if (done) {
            break
          }
          await new Promise<void>((resolve, reject) => {
            /** Rejects a blocked upload write when Chromium closes its request. */
            const closed = () =>
              reject(new DesktopError('ConnectionClosed', 'Upload connection closed'))
            req.once('close', closed)
            req.write(Buffer.from(value), undefined, () => {
              req.off('close', closed)
              resolve()
            })
          })
        }
        req.end()
      }
      void send().catch((cause) => {
        received.reject(cause)
        req.abort()
      })
    }
    return await received.promise
  } catch (error) {
    req.abort()
    throw error
  }
}

/** Keeps cancellation attached to the consumer even after Chromium ends its request-side events. */
function responseBody(stream: Readable, signal: AbortSignal, abort: () => void) {
  const source = (Readable.toWeb(stream) as ReadableStream<Uint8Array<ArrayBuffer>>).getReader()
  let listener: ReturnType<typeof addAbortListener>
  let ended = false
  return new ReadableStream<Uint8Array<ArrayBuffer>>(
    {
      /** Binds the consumer stream to cancellation after headers have arrived. */
      start(controller) {
        listener = addAbortListener(signal, () => {
          if (ended) {
            return
          }
          ended = true
          controller.error(signal.reason)
          abort()
          void source.cancel().catch(() => {})
        })
      },
      /** Reads only as much response data as requested by this consumer. */
      async pull(controller) {
        try {
          const chunk = await source.read()
          if (ended) {
            return
          }
          if (chunk.done) {
            ended = true
            listener[Symbol.dispose]()
            controller.close()
          } else {
            controller.enqueue(chunk.value)
          }
        } catch (error) {
          if (!ended) {
            ended = true
            listener[Symbol.dispose]()
            controller.error(error)
          }
        }
      },
      /** Aborts the underlying exchange and releases the reader. */
      async cancel() {
        ended = true
        listener[Symbol.dispose]()
        abort()
        await source.cancel()
      },
    },
    { highWaterMark: 0 },
  )
}
