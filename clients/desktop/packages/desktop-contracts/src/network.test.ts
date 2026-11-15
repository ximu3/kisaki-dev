/** @fileoverview Checks proxy endpoints reject embedded credentials and script paths. */

import { expect, test } from 'vite-plus/test'
import { parseProxyEndpoint } from './network'
import { DesktopError } from './errors'

test('proxy endpoints retain canonical addresses without credentials or PAC paths', () => {
  expect(parseProxyEndpoint('HTTP://localhost')).toBe('http://localhost:80')

  expect(() => parseProxyEndpoint('http://user:password@localhost:8080')).toThrow(DesktopError)

  expect(() => parseProxyEndpoint('http://localhost/pac')).toThrow(DesktopError)
})
