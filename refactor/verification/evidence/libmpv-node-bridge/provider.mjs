// Exercises provider ownership against actual native callbacks; not a public package facade.
import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks'
import { createRequire } from 'node:module'

const workContext = new AsyncLocalStorage()
const empty = new Uint8Array()
const maximumPosition = (1n << 63n) - 1n

function invalidResult() {
  return Object.assign(new Error('Invalid probe stream result.'), { code: 'invalidStreamResult' })
}

function captureSource(source) {
  if (typeof source !== 'object' || source === null) throw invalidResult()
  const methods = {
    read: source.read,
    seek: source.seek,
    getSize: source.getSize,
    close: source.close
  }
  if (typeof methods.read !== 'function' || typeof methods.close !== 'function')
    throw invalidResult()
  for (const method of [methods.seek, methods.getSize]) {
    if (method !== undefined && typeof method !== 'function') throw invalidResult()
  }
  return { source, methods }
}

export class ProbePlayer {
  constructor(addonPath, dllPath, provider) {
    this.resource = new AsyncResource('libmpv:probe-provider')
    this.provider = provider
    this.openSource = provider.open
    this.onError = provider.onError
    this.records = new Map()
    this.notifications = new Set()
    this.cleanupFailures = []
    this.events = []
    this.closing = false
    this.closePromise = null
    this.nativeDone = Promise.withResolvers()
    const { NativeBridge } = createRequire(import.meta.url)(addonPath)
    this.native = new NativeBridge(dllPath, (message) => {
      this.resource.runInAsyncScope(this.dispatch, this, message)
    })
    this.poller = setInterval(() => this.events.push(...this.native.poll()), 5)
  }

  assertControlAllowed() {
    if (workContext.getStore() === this) {
      throw Object.assign(new Error('Cannot reenter this probe core from stream work.'), {
        code: 'reentrantStreamCall'
      })
    }
  }

  load(uri = 'probe://memory.wav') {
    this.assertControlAllowed()
    this.native.command(['loadfile', uri])
  }

  stop() {
    this.assertControlAllowed()
    this.native.command(['stop'])
  }

  pause() {
    this.assertControlAllowed()
    return this.native.pause()
  }

  invoke(callback, receiver, argument) {
    return this.resource.runInAsyncScope(() =>
      workContext.run(this, () => callback.call(receiver, argument))
    )
  }

  abort(record) {
    this.resource.runInAsyncScope(() => workContext.run(this, () => record.controller.abort()))
  }

  report(record, operation, reason) {
    let delivery
    delivery = this.resource
      .runInAsyncScope(
        () =>
          new Promise((resolve) => {
            queueMicrotask(() => {
              try {
                this.onError.call(this.provider, { request: record.request, operation, reason })
              } finally {
                resolve()
              }
            })
          })
      )
      .finally(() => this.notifications.delete(delivery))
    this.notifications.add(delivery)
  }

  reply(message, ok, bytes = empty, value = '', source = null) {
    return this.native.respond(
      message.job,
      ok,
      bytes,
      value,
      Boolean(source?.methods.seek),
      Boolean(source?.methods.getSize)
    )
  }

  dispatch(message) {
    if (message.operation === 'nativeClosed') {
      this.nativeDone.resolve()
      return
    }
    let record = this.records.get(message.stream)
    if (message.operation === 'open') {
      if (this.closing) {
        this.reply(message, false)
        return
      }
      const controller = new AbortController()
      record = {
        id: message.stream,
        controller,
        request: { uri: message.uri, signal: controller.signal },
        owned: null,
        active: null,
        closeTask: null
      }
      this.records.set(message.stream, record)
    }
    if (!record) return
    if (message.operation === 'cancel') {
      this.abort(record)
      return
    }
    if (message.operation === 'close') {
      this.closeRecord(record)
      return
    }
    record.active = this.perform(record, message)
  }

  async perform(record, message) {
    const { operation } = message
    try {
      if (operation === 'open') {
        const source = await this.invoke(this.openSource, this.provider, record.request)
        record.owned = captureSource(source)
        const accepted = this.reply(message, true, empty, '', record.owned)
        if (!accepted || record.controller.signal.aborted) this.closeRecord(record)
        return
      }
      if (record.controller.signal.aborted || this.closing) {
        this.reply(message, false)
        return
      }
      const { source, methods } = record.owned
      const argument = operation === 'read' ? Number(message.value) : BigInt(message.value || 0)
      const result = await this.invoke(methods[operation], source, argument)
      if (operation === 'read') {
        if (
          result !== null &&
          (!(result instanceof Uint8Array) ||
            !(result.buffer instanceof ArrayBuffer) ||
            result.byteLength === 0 ||
            result.byteLength > argument)
        ) {
          throw invalidResult()
        }
        this.reply(message, true, result ?? empty)
      } else if (operation === 'getSize') {
        if (
          result !== null &&
          (typeof result !== 'bigint' || result < 0n || result > maximumPosition)
        ) {
          throw invalidResult()
        }
        this.reply(message, true, empty, result === null ? '-20' : String(result))
      } else {
        this.reply(message, true)
      }
    } catch (reason) {
      if (!record.controller.signal.aborted) this.report(record, operation, reason)
      this.reply(message, false)
      if (operation === 'open') this.closeRecord(record)
    }
  }

  closeRecord(record) {
    if (record.closeTask) return record.closeTask
    record.closeTask = (async () => {
      await record.active
      if (record.owned) {
        try {
          await this.invoke(record.owned.methods.close, record.owned.source)
        } catch (reason) {
          if (this.closing) this.cleanupFailures.push(reason)
          this.report(record, 'close', reason)
        }
      }
    })().finally(() => this.records.delete(record.id))
    return record.closeTask
  }

  close() {
    this.assertControlAllowed()
    if (this.closePromise) return this.closePromise
    this.closing = true
    clearInterval(this.poller)
    for (const record of this.records.values()) this.abort(record)
    this.native.closeNative()
    this.closePromise = (async () => {
      await this.nativeDone.promise
      await Promise.all([...this.records.values()].map((record) => this.closeRecord(record)))
      await Promise.all(this.notifications)
      this.resource.emitDestroy()
      if (this.cleanupFailures.length) {
        throw new AggregateError(this.cleanupFailures, 'Probe stream cleanup failed.')
      }
    })()
    return this.closePromise
  }
}
