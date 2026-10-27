import { expect, test } from 'vitest'
import { ESLint } from 'eslint'

test('one staged-file lint run can load root, application, package and extension configurations', async () => {
  const files = [
    'tools/hooks.ts',
    'packages/tooling/src/process.ts',
    'clients/desktop/app/src/shared/runtime-manifest.ts',
    'clients/desktop/packages/rpc/src/index.ts',
    'clients/desktop/extensions/projects/bangumi/kisx.config.ts',
  ]
  const results = await new ESLint().lintFiles(files)

  expect(results).toHaveLength(files.length)
  for (const result of results) expect(result.messages, result.filePath).toEqual([])
})
