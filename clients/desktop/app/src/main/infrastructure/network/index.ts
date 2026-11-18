/** @fileoverview Applies one saved network route to host and browser sessions and owns request cancellation. */

import {
  app,
  type Session,
  type ProxyConfig,
  type WebContents,
  type AuthenticationResponseDetails,
  type AuthInfo,
} from 'electron'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { StoredDefinition } from '@kisaki3/desktop-contracts/operations'
import type {
  NetworkPreferences,
  NetworkFetchOptions,
  NetworkState,
  ProxyCredentials,
} from '@kisaki3/desktop-contracts/network'
import { createSignal } from '../events'
import { request } from './request'

/** Creates a network owner for a dedicated host Session and the actual document Sessions it serves. */
export function createNetwork(
  host: Session,
  credentials: (revision: string) => Promise<ProxyCredentials | null>,
) {
  const sessions = new Set<Session>([host])
  const routed = new Set<Session>()
  const localSources = new Map<Session, string>()
  /** Publishes adoption state independently of HTTP response completion. */
  const changed = createSignal<NetworkState>()
  let state: NetworkState = { status: 'applying' }
  let applying = Promise.resolve()
  let generation = 0
  let route: ProxyConfig | undefined
  let authentication: { host: string; port: number; credentials: ProxyCredentials } | null = null
  let requests = new AbortController()

  /** Supplies the current readiness before subsequent route transitions. */
  function publish(next: NetworkState) {
    state = next
    changed.emit(next)
  }

  /** Stops browser requests while a route is being changed or after an unsuccessful adoption. */
  function guard(session: Session) {
    session.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
      (details, reply) => {
        const origin = new URL(details.url)
        const source = localSources.get(session)
        const local =
          source !== undefined &&
          (origin.protocol === 'http:' || origin.protocol === 'ws:') &&
          origin.host === source
        reply({ cancel: !local && (state.status !== 'ready' || !routed.has(session)) })
      },
    )
  }
  /** Answers only a matching proxy challenge from a browser owned by this network instance. */
  const browserLogin = (
    event: Electron.Event,
    contents: WebContents | null,
    _request: AuthenticationResponseDetails,
    challenge: AuthInfo,
    answer: (username?: string, password?: string) => void,
  ) => {
    if (!contents || !sessions.has(contents.session) || !challenge.isProxy) {
      return
    }
    event.preventDefault()
    if (
      state.status === 'ready' &&
      authentication &&
      challenge.host.toLowerCase() === authentication.host &&
      challenge.port === authentication.port
    ) {
      answer(authentication.credentials.username, authentication.credentials.password)
    } else {
      answer()
    }
  }
  app.on('login', browserLogin)
  guard(host)
  return {
    /** Sets the route before the next networking operation and closes connections opened under the previous route. */
    apply(saved: StoredDefinition<NetworkPreferences>) {
      const version = ++generation
      publish({ status: 'applying' })
      routed.clear()
      requests.abort(new DesktopError('ConnectionClosed', 'The network route changed'))
      requests = new AbortController()
      const work = applying
        .then(async () => {
          if (version !== generation) {
            return
          }
          await Promise.all(
            [...sessions].map(async (session) => {
              await session.closeAllConnections()
              await session.clearAuthCache()
            }),
          )
          if (saved.status === 'invalid') {
            throw new DesktopError(saved.error.code, saved.error.message)
          }
          const prefs = saved.value
          const config: ProxyConfig =
            prefs.mode === 'manual'
              ? {
                  mode: 'fixed_servers',
                  proxyRules: prefs.endpoint!,
                  proxyBypassRules: prefs.bypassRules,
                }
              : { mode: prefs.mode }
          const secret =
            prefs.mode === 'manual' && prefs.credentials
              ? await credentials(prefs.credentials.revision)
              : null
          const endpoint = prefs.endpoint && new URL(prefs.endpoint)
          await Promise.all(
            [...sessions].map(async (session) => {
              const source = localSources.get(session)
              const effective =
                source && config.mode === 'fixed_servers'
                  ? {
                      ...config,
                      proxyBypassRules: [config.proxyBypassRules, source].filter(Boolean).join(';'),
                    }
                  : config
              await session.setProxy(effective)
              if (version === generation) {
                routed.add(session)
              }
            }),
          )
          if (version !== generation) {
            return
          }
          route = config
          authentication =
            secret && endpoint
              ? {
                  host: endpoint.hostname.toLowerCase(),
                  port: Number(endpoint.port || (endpoint.protocol === 'https:' ? 443 : 80)),
                  credentials: secret,
                }
              : null
          publish({ status: 'ready' })
        })
        .catch((cause: unknown) => {
          if (version === generation) {
            route = undefined
            authentication = null
            publish({
              status: 'failed',
              error:
                cause instanceof DesktopError
                  ? { code: cause.code, message: cause.message }
                  : {
                      code: 'OperationFailed',
                      message: 'The selected network route could not be applied',
                    },
            })
          }
        })
      applying = work
      return work
    },
    /** Adds a native window's real browser session before loading its first document. */
    async attach(session: Session, developmentUrl?: string) {
      sessions.add(session)
      if (developmentUrl) {
        localSources.set(session, new URL(developmentUrl).host)
      }
      guard(session)
      const attached = applying.then(async () => {
        if (route) {
          const source = localSources.get(session)
          const effective =
            source && route.mode === 'fixed_servers'
              ? {
                  ...route,
                  proxyBypassRules: [route.proxyBypassRules, source].filter(Boolean).join(';'),
                }
              : route
          await session.setProxy(effective)
          routed.add(session)
        }
      })
      applying = attached.catch(() => {})
      try {
        await attached
      } catch (error) {
        sessions.delete(session)
        localSources.delete(session)
        session.webRequest.onBeforeRequest(null)
        throw error
      }
      return async () => {
        sessions.delete(session)
        routed.delete(session)
        localSources.delete(session)
        session.webRequest.onBeforeRequest(null)
        await session.closeAllConnections()
      }
    },
    /** Opens one request against the current route and keeps its signal bound through body consumption. */
    async fetch(url: string | URL, options: NetworkFetchOptions = {}) {
      await applying
      options.signal?.throwIfAborted()
      if (state.status !== 'ready') {
        throw new DesktopError('OperationFailed', 'The selected network route is unavailable')
      }
      return request(
        host,
        url,
        options,
        options.signal ? AbortSignal.any([requests.signal, options.signal]) : requests.signal,
        authentication,
      )
    },
    /** Reads route readiness for new traffic. */
    async getState() {
      return state
    },
    /** Delivers current and subsequent route adoption states. */
    observe(listener: (state: NetworkState) => void) {
      const hold = changed.on(listener)
      listener(state)
      return hold
    },
    /** Closes host requests and removes browser proxy-authentication handling. */
    async close(this: void) {
      app.off('login', browserLogin)
      generation++
      requests.abort(new DesktopError('ConnectionClosed', 'The application is closing'))
      await applying
      await Promise.all([...sessions].map((session) => session.closeAllConnections()))
      sessions.clear()
    },
  }
}
