import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { copyFile, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const repository = 'F:/project/kisaki'
const require = createRequire(import.meta.url)
const temporary = await realpath(tmpdir())
const root = await mkdtemp(join(temporary, 'kisaki-import-readability-'))
const reports: { name: string; status: number | null; output: string }[] = []
const write = async (path: string, value: unknown) => {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2))
}
function run(name: string, file: string, args: string[], cwd: string): string {
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 2 * 1024 * 1024,
  })
  const output = result.stdout + result.stderr
  reports.push({ name, status: result.status, output })
  if (result.error || result.status !== 0) {
    throw new Error(`${name} failed: ${output}`, { cause: result.error })
  }
  return result.stdout
}

try {
  await write(join(root, 'package.json'), { type: 'module', private: true })
  await write(join(root, 'tsconfig.base.json'), {
    compilerOptions: {
      target: 'ES2023', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
      noEmit: true, types: ['node'], paths: { '@repo-tools/*': ['./tools/lib/*.ts'] },
    },
  })
  await write(join(root, 'tools/lib/value.ts'), "export const value = 'shared-tool'\nexport const source = import.meta.url\n")
  await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'junction')
  for (const project of ['clients/desktop/app', 'clients/desktop/packages/example']) {
    const directory = join(root, project)
    const base = relative(directory, join(root, 'tsconfig.base.json')).replaceAll('\\', '/')
    await write(join(directory, 'package.json'), { type: 'module', private: true })
    await write(join(directory, 'tsconfig.json'), {
      extends: base, files: [], references: [
        { path: './config/typescript/tsconfig.tools.json' },
        { path: './config/typescript/tsconfig.tests.json' },
      ],
    })
    await write(join(directory, 'config/typescript/tsconfig.tools.json'), {
      extends: '../../' + base, include: ['../../tools/**/*.ts'],
    })
    await write(join(directory, 'config/typescript/tsconfig.tests.json'), {
      extends: '../../' + base, include: ['../../tests/**/*.ts', '../../playwright-tests/**/*.ts'],
    })
    await write(join(directory, 'tools/check.ts'), "import { value, source } from '@repo-tools/value'\nconsole.log(JSON.stringify({ value, source }))\n")
    const loader = pathToFileURL(require.resolve('tsx')).href
    const result = JSON.parse(run('tsx ' + project, '--import', [loader, 'tools/check.ts'], directory)) as { value: string; source: string }
    if (result.value !== 'shared-tool' || result.source !== pathToFileURL(join(root, 'tools/lib/value.ts')).href) throw new Error('The alias resolved to a different module')
    run('tsc ' + project, join(repository, 'node_modules/typescript/bin/tsc'), ['-p', 'config/typescript/tsconfig.tools.json'], directory)
  }
  const application = join(root, 'clients/desktop/app')
  await write(join(application, 'vitest.config.ts'), "import { defineConfig } from 'vitest/config'\nexport default defineConfig({ resolve: { tsconfigPaths: true }, test: { environment: 'node', include: ['tests/**/*.test.ts'] } })\n")
  await write(join(application, 'tests/imports.test.ts'), "import { expect, test } from 'vitest'\nimport { value } from '@repo-tools/value'\ntest('resolves the shared engineering alias', () => expect(value).toBe('shared-tool'))\n")
  run('vitest', join(repository, 'node_modules/vitest/vitest.mjs'), ['run', '--config', 'vitest.config.ts'], application)
  await write(join(application, 'playwright.config.ts'), "import { defineConfig } from '@playwright/test'\nexport default defineConfig({ testDir: './playwright-tests', workers: 1, reporter: 'line' })\n")
  await write(join(application, 'playwright-tests/imports.spec.ts'), "import { expect, test } from '@playwright/test'\nimport { value } from '@repo-tools/value'\ntest('resolves the shared engineering alias', () => expect(value).toBe('shared-tool'))\n")
  run('playwright', join(repository, 'node_modules/@playwright/test/cli.js'), ['test', '--config', 'playwright.config.ts'], application)

  await copyFile(join(repository, '.dependency-cruiser.json'), join(root, '.dependency-cruiser.json'))
  await write(join(application, 'src/invalid.ts'), "import { value } from '@repo-tools/value'\nexport { value }\n")
  const result = JSON.parse(run('runtime boundary', join(repository, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs'), ['--config', '.dependency-cruiser.json', '--output-type', 'json', 'clients/desktop/app/src/invalid.ts'], root)) as { summary: { violations: { rule: { name: string } }[] } }
  if (!result.summary.violations.some((item) => item.rule.name === 'runtime-does-not-import-engineering')) throw new Error('The alias bypassed the runtime boundary')
  console.log(JSON.stringify({ passed: reports.map(({ name, status }) => ({ name, status })), mappingCount: 1 }))
} finally {
  await writeFile(join(repository, '.cache/readable-imports/results.json'), JSON.stringify(reports, null, 2) + '\n')
  if (dirname(root) !== temporary || !basename(root).startsWith('kisaki-import-readability-')) throw new Error('The fixture cleanup escaped its temporary parent')
  await rm(root, { recursive: true, force: true, maxRetries: 3 })
}
