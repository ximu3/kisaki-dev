// Exercise HTTP shutdown on the candidate Node runtime without a container engine.
import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = new URL('./', import.meta.url)
const inputs = JSON.parse(readFileSync(new URL('source-input.json', here), 'utf8'))
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')

async function childMain() {
  const { Hono } = await import(
    pathToFileURL(inputs.packages.find((row) => row.name === 'hono').entry)
  )
  const { serve } = await import(
    pathToFileURL(inputs.packages.find((row) => row.name === '@hono/node-server').entry)
  )
  const [upstream, mode] = process.argv.slice(3)
  const deadlineMs = mode === 'drain' ? 1000 : 100
  const active = new Set()
  const tasks = new Set()
  let closing = false
  let stopPromise
  let forced = false
  let cleanupNotifications = 0
  const app = new Hono()
  app.use('*', async (context, next) => {
    if (closing) return context.json({ error: 'temporarily_unavailable' }, 503)
    await next()
  })
  app.get('/healthz', (context) => context.json({ status: 'ok' }))
  app.get('/work', (context) => {
    const controller = new AbortController()
    active.add(controller)
    const task = (async () => {
      try {
        const response = await fetch(upstream, { signal: controller.signal })
        await response.text()
        return context.json({ complete: true })
      } catch {
        if (!controller.signal.aborted) throw new Error('The owned upstream request failed.')
        return context.json({ error: 'temporarily_unavailable' }, 503)
      } finally {
        active.delete(controller)
      }
    })()
    tasks.add(task)
    return task.finally(() => tasks.delete(task))
  })
  const server = await new Promise((resolve, reject) => {
    const instance = serve(
      { fetch: app.fetch, hostname: '127.0.0.1', port: 0, overrideGlobalObjects: false },
      () => resolve(instance)
    )
    instance.once('error', reject)
  })
  // Connections that become idle after close() began no longer need keep-alive.
  server.on('request', (_request, response) => {
    response.once('finish', () => {
      if (closing) server.closeIdleConnections()
    })
  })

  function shutdown() {
    if (stopPromise) return stopPromise
    closing = true
    stopPromise = (async () => {
      const started = performance.now()
      const force = setTimeout(() => {
        forced = true
        for (const controller of active) controller.abort()
        server.closeAllConnections()
      }, deadlineMs)
      try {
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        )
        await Promise.allSettled([...tasks])
      } finally {
        clearTimeout(force)
      }
      cleanupNotifications++
      const result = {
        type: 'closed',
        forced,
        activeRequests: active.size,
        activeTasks: tasks.size,
        listenerClosed: !server.listening,
        cleanupNotifications,
        elapsedMs: Math.round(performance.now() - started)
      }
      if (process.connected) {
        await new Promise((resolve, reject) =>
          process.send(result, (error) => (error ? reject(error) : resolve()))
        )
        process.disconnect()
      }
    })()
    return stopPromise
  }

  const stop = () => {
    void shutdown().catch(() => {
      process.exitCode = 1
    })
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  // IPC invokes the same shutdown function; it is only the Windows test driver.
  process.on('message', (message) => {
    if (message.type === 'shutdown') stop()
  })
  process.on('disconnect', stop)
  process.send({
    type: 'ready',
    origin: `http://127.0.0.1:${server.address().port}`,
    node: process.version
  })
}

async function runCase(mode) {
  let startedResolve
  const started = new Promise((resolve) => {
    startedResolve = resolve
  })
  let upstreamAborted = false
  const upstream = createServer((_request, response) => {
    response.on('close', () => {
      if (!response.writableEnded) upstreamAborted = true
    })
    if (mode === 'drain') setTimeout(() => response.end('owned-fixture'), 60)
    startedResolve()
  })
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const environment = { ...process.env }
  delete environment.NODE_OPTIONS
  delete environment.NODE_PATH
  const child = fork(
    fileURLToPath(import.meta.url),
    ['child', `http://127.0.0.1:${upstream.address().port}`, mode],
    {
      execPath: inputs.node.path,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      windowsHide: true
    }
  )
  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-8000)
  })
  let readyResolve
  let closedResolve
  const ready = new Promise((resolve) => {
    readyResolve = resolve
  })
  const closed = new Promise((resolve) => {
    closedResolve = resolve
  })
  const exit = new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
  child.on('message', (message) => {
    if (message.type === 'ready') readyResolve(message)
    if (message.type === 'closed') closedResolve(message)
  })
  let watchdog
  try {
    const timeout = new Promise((_, reject) => {
      watchdog = setTimeout(() => reject(new Error('The lifecycle fixture did not finish.')), 5000)
    })
    return await Promise.race([
      timeout,
      (async () => {
        const entry = await ready
        assert.equal(entry.node, inputs.node.version)
        const health = await fetch(`${entry.origin}/healthz`)
        assert.equal(health.status, 200)
        assert.deepEqual(await health.json(), { status: 'ok' })
        const pending = fetch(`${entry.origin}/work`).then(
          async (response) => ({ status: response.status, body: await response.json() }),
          () => ({ connectionClosed: true })
        )
        await started
        child.send({ type: 'shutdown' })
        child.send({ type: 'shutdown' })
        const [result, processResult, requestResult] = await Promise.all([closed, exit, pending])
        assert.equal(processResult.code, 0, stderr)
        assert.equal(processResult.signal, null)
        assert.equal(result.cleanupNotifications, 1)
        assert.equal(result.activeRequests, 0)
        assert.equal(result.activeTasks, 0)
        assert.equal(result.listenerClosed, true)
        assert.equal(result.forced, mode === 'deadline')
        assert.equal(upstreamAborted, mode === 'deadline')
        if (mode === 'drain') {
          assert.equal(requestResult.status, 200)
          assert.deepEqual(requestResult.body, { complete: true })
        } else assert(requestResult.connectionClosed || requestResult.status === 503)
        return {
          mode,
          node: entry.node,
          ...result,
          processExit: processResult,
          requestResult,
          upstreamAborted,
          stderr
        }
      })()
    ])
  } finally {
    clearTimeout(watchdog)
    if (child.exitCode === null) child.kill()
    upstream.closeAllConnections()
    await new Promise((resolve) => upstream.close(resolve))
  }
}

if (process.argv[2] === 'child') await childMain()
else {
  assert.equal(hash(readFileSync(inputs.node.path)), inputs.node.exeSha256)
  const cases = []
  for (const mode of ['drain', 'deadline']) cases.push(await runCase(mode))
  const receipt = {
    checkedAt: new Date().toISOString(),
    cases,
    sourceReceiptSha256: hash(readFileSync(new URL('source-input.json', here))),
    scriptSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
    nativePosixSignalExecuted: false,
    dockerStopExecuted: false,
    actualProviderRequests: false,
    productionRelayImplemented: false
  }
  writeFileSync(new URL('lifecycle-contract.json', here), `${JSON.stringify(receipt, null, 2)}\n`)
  process.stdout.write(
    `${JSON.stringify({ cases: cases.length, node: inputs.node.version, allExited: true })}\n`
  )
}
