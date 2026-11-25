import { expect, test } from 'vite-plus/test'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { parseJsonValue as parseDesktopValue } from '@kisaki3/desktop-contracts/json'
import { parseJsonValue as parseRpcValue, RpcError } from '@kisaki3/desktop-rpc'

test.each([
  { name: 'desktop', parse: parseDesktopValue, error: DesktopError },
  { name: 'RPC', parse: parseRpcValue, error: RpcError },
])(
  '$name snapshots ordinary data without reading accessors or discarding properties',
  ({ parse, error }) => {
    const child = { title: 'A' }
    const snapshot = parse({ list: [child, child], zero: -0 })
    child.title = 'B'
    expect(snapshot).toStrictEqual({ list: [{ title: 'A' }, { title: 'A' }], zero: 0 })

    let reads = 0
    const getter = {
      enumerable: true,
      get() {
        reads++
        return 'A'
      },
    }
    for (const input of [
      Object.defineProperty({}, 'title', getter),
      Object.defineProperty([], '0', getter),
      Object.defineProperty([1], 'extra', { value: true }),
    ]) {
      expect(() => parse(input)).toThrow(error)
    }
    expect(reads).toBe(0)
  },
)
