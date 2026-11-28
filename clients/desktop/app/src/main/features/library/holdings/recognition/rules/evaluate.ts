import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import type { FileRecognitionDefinition, FileWorkType } from '@kisaki3/desktop-contracts/library'
import { Worker } from 'node:worker_threads'
import type { Condition, NumberConversion } from './output'

interface RuleHit {
  ruleId: string
  input: string
  captures: Record<string, string>
  numbers: NumberConversion[]
  conditions: Condition[]
}

export class RecognitionOutputError extends DesktopError {
  constructor(
    readonly ruleId: string,
    message: string,
  ) {
    super('InvalidInput', message)
  }
}

type WorkerReply =
  | { ready: true }
  | { ok: true; value: RuleHit | null }
  | { ok: false; ruleId: string | null; message: string }

export async function openEvaluator(
  entry: URL,
  medium: FileWorkType,
  definition: FileRecognitionDefinition,
  signal: AbortSignal,
) {
  signal.throwIfAborted()
  const thread = new Worker(entry)
  const started = Promise.withResolvers<void>()
  let pending: ReturnType<typeof Promise.withResolvers<RuleHit | null>> | undefined
  let stopped: Promise<number> | undefined
  function stop() {
    stopped ??= thread.terminate()
    return stopped
  }
  function fail(cause: unknown) {
    started.reject(cause)
    pending?.reject(cause)
    void stop()
  }
  const abort = () => fail(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  thread.on('error', fail)
  thread.on('exit', () => {
    if (!stopped) {
      fail(new DesktopError('ReadFailed', 'The file-rule worker exited'))
    }
  })
  thread.on('message', (reply: WorkerReply) => {
    if ('ready' in reply) {
      started.resolve()
      return
    }
    if (reply.ok) {
      pending?.resolve(reply.value)
    } else if (reply.ruleId) {
      pending?.reject(new RecognitionOutputError(reply.ruleId, reply.message))
    } else {
      pending?.reject(new DesktopError('InvalidInput', reply.message))
    }
  })
  async function request(message: object) {
    signal.throwIfAborted()
    if (stopped) {
      throw new DesktopError('ResourceLimit', 'The file rule execution budget was exhausted')
    }
    const reply = Promise.withResolvers<RuleHit | null>()
    pending = reply
    const timeout = setTimeout(
      () => fail(new DesktopError('ResourceLimit', 'The file rule execution budget was exhausted')),
      500,
    )
    try {
      thread.postMessage(message)
      return await reply.promise
    } finally {
      clearTimeout(timeout)
      pending = undefined
    }
  }
  async function close() {
    signal.removeEventListener('abort', abort)
    await stop()
  }
  try {
    await started.promise
    await request({ type: 'compile', medium, definition })
    return {
      match: (baseName: string, path?: string) => request({ type: 'test', baseName, path }),
      close,
    }
  } catch (cause) {
    await close()
    throw cause
  }
}
