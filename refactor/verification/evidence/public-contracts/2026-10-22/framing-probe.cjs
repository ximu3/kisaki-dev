// Validate byte framing only; this is not the development-session implementation.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const limit = 1_048_576
const utf8 = new TextDecoder('utf-8', { fatal: true })

function encode(value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8')
  if (!body.length || body.length > limit) throw new Error('Invalid frame length.')
  const header = Buffer.alloc(4)
  header.writeUInt32BE(body.length)
  return Buffer.concat([header, body])
}

function decode(chunks) {
  let pending = Buffer.alloc(0)
  let bodyLength = null
  const values = []
  for (const chunk of chunks) {
    pending = Buffer.concat([pending, chunk])
    for (;;) {
      if (bodyLength === null) {
        if (pending.length < 4) break
        bodyLength = pending.readUInt32BE()
        pending = pending.subarray(4)
        if (!bodyLength || bodyLength > limit) throw new Error('Invalid frame length.')
      }
      if (pending.length < bodyLength) break
      const value = JSON.parse(utf8.decode(pending.subarray(0, bodyLength)))
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Expected an object frame.')
      }
      values.push(value)
      pending = pending.subarray(bodyLength)
      bodyLength = null
    }
  }
  if (pending.length || bodyLength !== null) throw new Error('Truncated frame.')
  return values
}

const checks = []
const check = (name, run) => {
  run()
  checks.push({ name, passed: true })
}
const value = {
  type: 'failed',
  sessionId: 'fixture',
  error: { code: 'OperationFailed', message: '日文と中文 \u{1F3AE}' }
}
const frame = encode(value)

check('Header length counts UTF-8 bytes and excludes the header', () => {
  assert.equal(frame.readUInt32BE(), Buffer.byteLength(JSON.stringify(value)))
  assert.equal(frame.length, frame.readUInt32BE() + 4)
})
check('Every single split position reconstructs the same message', () => {
  for (let i = 1; i < frame.length; i++) {
    assert.deepEqual(decode([frame.subarray(0, i), frame.subarray(i)]), [value])
  }
})
check('Byte-by-byte chunks preserve multibyte text', () => {
  assert.deepEqual(decode([...frame].map((byte) => Buffer.from([byte]))), [value])
})
check('Multiple coalesced messages remain separate', () => {
  const second = { type: 'stop', sessionId: 'fixture', requestId: 1 }
  assert.deepEqual(decode([Buffer.concat([frame, encode(second), frame])]), [value, second, value])
})
check('Zero and excessive lengths are rejected from the header alone', () => {
  for (const size of [0, limit + 1, 0xffffffff]) {
    const header = Buffer.alloc(4)
    header.writeUInt32BE(size)
    assert.throws(() => decode([header]), /Invalid frame length/)
  }
})
check('Invalid UTF-8, JSON and non-object bodies are rejected', () => {
  const invalid = Buffer.from([0, 0, 0, 2, 0xc3, 0x28])
  assert.throws(() => decode([invalid]))
  assert.throws(() => decode([Buffer.from([0, 0, 0, 1, 0x7b])]))
  for (const body of [null, true, [], 1, 'text']) assert.throws(() => decode([encode(body)]))
})
check('EOF with an incomplete header or body is not a complete message', () => {
  for (let i = 1; i < frame.length; i++) assert.throws(() => decode([frame.subarray(0, i)]))
})
check('The exact maximum body succeeds and one extra byte is rejected', () => {
  const base = Buffer.byteLength(JSON.stringify({ text: '' }))
  assert.equal(encode({ text: 'a'.repeat(limit - base) }).readUInt32BE(), limit)
  assert.throws(() => encode({ text: 'a'.repeat(limit - base + 1) }))
})

fs.writeFileSync(
  path.join(__dirname, 'framing-results.json'),
  JSON.stringify({ node: process.version, limitBytes: limit, checks, passed: true }, null, 2)
)
process.stdout.write(JSON.stringify({ groups: checks.length, passed: true }) + '\n')
