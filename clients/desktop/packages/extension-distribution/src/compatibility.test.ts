import { expect, test } from 'vite-plus/test'
import { getCompatibilityIssues, targetForPlatform } from './compatibility'
import type { CompatibilityEnvironment } from './compatibility'
import { artifact } from '../tests/support/fixtures'

/** Fixed synthetic desktop capabilities used to compare declared compatibility requirements. */
const host: CompatibilityEnvironment = {
  target: 'windows-x64',
  apiVersion: '1.2.0',
  nodeVersion: '24.11.1',
  electronVersion: '42.0.0',
}

test('host matching uses process architecture and reports all actual runtime failures', () => {
  expect(targetForPlatform('win32', 'arm64')).toBe('windows-arm64')
  expect(targetForPlatform('darwin', 'x64')).toBe('macos-x64')
  expect(targetForPlatform('linux', 'x64')).toBe('linux-x64')
  expect(targetForPlatform('win32', 'ia32')).toBeUndefined()

  const conditions = artifact({
    targets: ['linux-x64'],
    apiVersionRange: '^2',
    nodeVersionRange: '>=26',
    electronVersionRange: '>=50',
  })

  expect(getCompatibilityIssues(conditions, host).map((issue) => issue.condition)).toEqual([
    'target',
    'apiVersion',
    'nodeVersion',
    'electronVersion',
  ])

  const missing = getCompatibilityIssues(artifact({ nodeVersionRange: '*' }), {
    target: 'windows-x64',
    apiVersion: '1.0.0',
  })
  expect(missing).toStrictEqual([{ condition: 'nodeVersion', required: '*' }])
  expect(JSON.parse(JSON.stringify(missing))).toStrictEqual(missing)

  expect(getCompatibilityIssues(artifact(), { ...host, apiVersion: '1.2.0-beta.1' })).toHaveLength(
    1,
  )
  expect(
    getCompatibilityIssues(artifact({ apiVersionRange: '>=1.2.0-beta.1 <2' }), {
      ...host,
      apiVersion: '1.2.0-beta.2',
    }),
  ).toEqual([])
})
