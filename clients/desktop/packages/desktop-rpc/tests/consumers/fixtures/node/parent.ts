/** @fileoverview Consumes the installed ESM package in both directions of a real child process. */

import assert from 'node:assert/strict'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { RpcConnection } from '@kisaki3/desktop-rpc'
import { ipcTransport } from './ipc.js'

/** Owned child process running the packed RPC consumer with JSON IPC serialization. */
const child = fork(new URL('./child.js', import.meta.url), [], { serialization: 'json' })

/** Child-process completion observed before the parent fixture finishes. */
const exited = once(child, 'exit')

/** Cancellation owner triggered when the child reports that its work has started. */
const cancel = new AbortController()

/** Parent-side packed RPC connection used to verify bidirectional calls and cancellation. */
const rpc = new RpcConnection(ipcTransport(child), {
  protocol: { id: 'fixture.child', version: 1 },
  handshake: { role: 'initiator', context: null },
  methods: {
    /** Returns the reverse-call payload without changing its JSON value. */
    echo: (args) => args,
  },
  notifications: {
    topics: {
      /** Requests cancellation after the child confirms its work has started. */
      started: () => cancel.abort(),
    },
    onError: console.error,
  },
})

try {
  assert.equal(await rpc.ready, 'child')

  const args = [{ ['__proto__']: ['資料', null, false, 0] }]
  assert.deepEqual(await rpc.request('roundTrip', args), args)

  await assert.rejects(rpc.request('restricted'), {
    code: 'PermissionDenied',
    message: 'Read access required',
  })

  assert.deepEqual(await rpc.request('work', [], { signal: cancel.signal }), { committed: 1 })

  await assert.rejects(rpc.request('detach'), { code: 'ConnectionClosed' })
} finally {
  rpc.close()
  assert.deepEqual(await exited, [0, null])
}
