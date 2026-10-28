import { on } from 'node:events'
import { writeFile, realpath } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { tmpdir, cpus } from 'node:os'
import assert from 'node:assert/strict'
import { prepareDevelopmentWorkspace } from '../../clients/desktop/app/tests/support/development-workspace'
import { startDevelopmentController } from '../../clients/desktop/app/tests/support/development-session'

const started = performance.now()
const events: object[] = []
const record = (event: string, details: object = {}) => {
  const entry = { elapsedMs: Math.round((performance.now() - started) * 100) / 100, event, ...details }
  events.push(entry)
  console.log(JSON.stringify(entry))
}
let workspace: Awaited<ReturnType<typeof prepareDevelopmentWorkspace>> | undefined
let failure: unknown

try {
  record('workspace-prepare-start')
  workspace = await prepareDevelopmentWorkspace()
  record('workspace-prepare-finished')
  for (const attempt of ['first', 'warm']) {
    record('controller-start', { attempt })
    const controller = startDevelopmentController(workspace.app)
    controller.process.on('message', (value) => record('controller-state', { attempt, value }))
    for (const [stream, pipe] of [['stdout', controller.process.stdout], ['stderr', controller.process.stderr]] as const) {
      pipe!.on('data', (chunk: string) => record('controller-output', { attempt, stream, text: chunk.slice(-8_192) }))
    }
    let ready = false
    try {
      for await (const [message] of on(controller.process, 'message', { signal: AbortSignal.timeout(120_000), close: ['close'] })) {
        if (message.state === 'failed') throw new Error('Development preparation failed: ' + controller.diagnostics())
        if (message.state === 'ready') {
          ready = true
          break
        }
      }
      if (!ready) throw new Error('Development controller closed before ready')
      record('normal-stop-requested', { attempt })
    } finally {
      await controller.close()
      const code = await controller.closed
      record('controller-closed', { attempt, code, signal: controller.process.signalCode })
      if (code !== 0 || controller.process.signalCode !== null) throw new Error('Development controller did not exit normally')
    }
  }
} catch (cause) {
  failure = cause
  record('probe-failed', { message: cause instanceof Error ? cause.message : String(cause) })
} finally {
  if (workspace) {
    const resolved = await realpath(workspace.root)
    assert.equal(dirname(resolved), await realpath(tmpdir()))
    assert.ok(basename(resolved).startsWith('kisaki-dev-workspace-'))
    await workspace.close()
    record('workspace-removed')
  }
  await writeFile('F:/project/kisaki/refactor/verification/evidence/ci-exploration/2026-10-27/development-phases-fixed-windows-x64.json', JSON.stringify({ platform: process.platform, arch: process.arch, node: process.version, cpu: cpus()[0]?.model, note: 'One Git-aware isolated workspace with explicit Electron preparation, first and warm sessions. Local Windows x64 observation, not Windows arm64 CI timing.', events }, null, 2) + '\n')
}
if (failure) process.exitCode = 1
