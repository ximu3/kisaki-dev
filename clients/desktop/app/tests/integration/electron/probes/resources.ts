/** @fileoverview Verifies independent document bindings, exact ranges and revocation on real Electron session protocols. */

import assert from 'node:assert/strict'
import { session } from 'electron'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createResources } from '../../../../src/main/infrastructure/resources'

/** Reads one held fixture across two scopes and confirms that closing one view preserves the other. */
export async function verifyResourceBindings(profile: string) {
  const registry = createResources()
  const a = session.fromPartition('test-resources-' + randomUUID())
  const b = session.fromPartition('test-resources-' + randomUUID())
  const first = registry.view(a),
    sibling = registry.view(a),
    other = registry.view(b)
  const path = join(profile, 'held-resource')
  await writeFile(path, 'abcdef')
  let released = 0
  const read = registry.acquire({ path, size: 6, mediaType: 'text/plain' }, async () => {
    released++
  })
  try {
    const left = await first.bind({ sample: read.resource })
    const right = await sibling.bind({ sample: read.resource })
    await read.dispose()
    const response = await a.fetch(left.urls.sample, { headers: { Range: 'bytes=1-3' } })
    assert.equal(response.status, 206)
    assert.equal(response.headers.get('content-range'), 'bytes 1-3/6')
    assert.equal(await response.text(), 'bcd')
    assert.equal((await b.fetch(left.urls.sample)).status, 404)
    await first.dispose()
    assert.equal((await a.fetch(left.urls.sample)).status, 404)
    assert.equal(await (await a.fetch(right.urls.sample)).text(), 'abcdef')
    await right.dispose()
    assert.equal(released, 1)
  } finally {
    await Promise.all([first.dispose(), sibling.dispose(), other.dispose(), read.dispose()])
  }
}
