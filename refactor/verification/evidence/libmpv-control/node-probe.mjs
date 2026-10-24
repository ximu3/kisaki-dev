// Verify standard Node mechanisms, without implementing or loading an Mpv resource.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const abortResults = []
for (const preAborted of [false, true]) {
  const controller = new AbortController()
  const reason = { kind: 'local-probe' }
  if (preAborted) controller.abort(reason)
  const pending = delay(60_000, undefined, { signal: controller.signal })
  if (!preAborted) controller.abort(reason)
  let captured
  await assert.rejects(pending, (error) => {
    captured = error
    return error.name === 'AbortError' && error.code === 'ABORT_ERR' && error.cause === reason
  })
  abortResults.push({
    preAborted,
    name: captured.name,
    code: captured.code,
    causeIdentityPreserved: captured.cause === reason,
    causeEnumerable: Object.getOwnPropertyDescriptor(captured, 'cause').enumerable
  })
}

function runChild(source) {
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 3_000,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0)
  return result.stdout
}

const referencedOutput = runChild("setTimeout(() => process.stdout.write('fired'), 10)")
const unreferencedOutput = runChild(`
  const timer = setTimeout(() => process.stdout.write('fired'), 60_000)
  if (!timer.hasRef()) throw new Error('Expected a referenced timer.')
  timer.unref()
  if (timer.hasRef()) throw new Error('Expected an unreferenced timer.')
`)
assert.equal(referencedOutput, 'fired')
assert.equal(unreferencedOutput, '')

const disposal = []
{
  await using resource = {
    async [Symbol.asyncDispose]() {
      disposal.push('dispose-start')
      await Promise.resolve()
      disposal.push('dispose-finish')
    }
  }
  disposal.push('body')
  void resource
}
assert.deepEqual(disposal, ['body', 'dispose-start', 'dispose-finish'])

const result = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  abortResults,
  referencedTimerCompleted: referencedOutput === 'fired',
  unreferencedTimerAllowedExit: unreferencedOutput === '',
  asyncDisposalOrder: disposal,
  nativeAddonExecuted: false,
  proposedMpvErrorsInstantiated: false,
  proposedMpvKeepaliveExecuted: false,
  nativeEnvironmentCleanupVerified: false
}
await writeFile(
  new URL('./node-contract.json', import.meta.url),
  `${JSON.stringify(result, null, 2)}\n`
)
process.stdout.write(
  JSON.stringify({
    node: result.node,
    abortCases: abortResults.length,
    refAndUnref: 'pass',
    asyncDispose: 'pass',
    nativeExecuted: false
  })
)
