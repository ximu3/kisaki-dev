import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFile, execFileSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { parse } from 'yaml'

const root = process.cwd()
const directory = '.local/script-audit/implementation-probes'
await mkdir(directory, { recursive: true })
const run = promisify(execFile)
const git = (args: string[], env = process.env, input?: string) =>
  execFileSync('git', args, { cwd: root, env, input, encoding: 'utf8', windowsHide: true }).trimEnd()
const before = git(['status', '--porcelain'])
const parent = git(['rev-parse', 'HEAD'])
const index = resolve(directory, 'index')
assert(index.startsWith(root + '\\'))
const indexed = { ...process.env, GIT_INDEX_FILE: index }
const commit = (tree: string, base: string, message: string) =>
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgSign=false', 'commit-tree', tree, '-p', base, '-m', message], indexed)
assert.equal(before, '')
const base = parent
const desktopText = await readFile('.github/workflows/verification-desktop.yml', 'utf8')
const repositoryText = await readFile('.github/workflows/verification-repository.yml', 'utf8')
const coordinatorText = await readFile('.github/workflows/verification.yml', 'utf8')
const desktop = parse(desktopText)
const repository = parse(repositoryText)
const coordinator = parse(coordinatorText)
const selectors = {
  desktop: desktop.jobs.select.steps.find((step: { id?: string }) => step.id === 'affected'),
  repository: repository.jobs.repository.steps.find((step: { id?: string }) => step.id === 'affected'),
}
const prefix = 'export PATH="$PWD/.local/ci-design/bin:$PATH"\n'
async function executeScript(name: string, source: string, env: Record<string, string>) {
  const script = `${directory}/${name}.sh`
  await writeFile(script, prefix + source)
  return run('D:/Git/bin/bash.exe', ['--noprofile', '--norc', '-e', '-o', 'pipefail', script], {
    cwd: root, windowsHide: true, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, ...env },
  })
}
async function select(owner: 'desktop' | 'repository', name: string, head: string) {
  const output = `${directory}/${name}-${owner}.txt`
  await writeFile(output, '')
  await executeScript(`${name}-${owner}`, selectors[owner].run, {
    REQUEST_COMPLETE: 'false', TURBO_SCM_BASE: base, TURBO_SCM_HEAD: head,
    TARGETS: selectors.desktop.env.TARGETS, RUNNER_TEMP: directory, GITHUB_OUTPUT: output,
  })
  await writeFile(`${directory}/${name}-${owner}-affected.json`, await readFile('test-results/verification/affected.json'))
  return Object.fromEntries((await readFile(output, 'utf8')).trim().split(/\r?\n/).map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]
  }))
}

const cases = [
  { path: '.github/workflows/pr-title.yml', targets: 0, consumers: false },
  { path: 'clients/desktop/packages/desktop-contracts/vitest.config.ts', targets: 0, consumers: false },
  { path: 'clients/desktop/packages/desktop-contracts/config/typescript/tsconfig.tests.json', targets: 0, consumers: false },
  { path: 'clients/desktop/packages/desktop-contracts/src/development.test.ts', targets: 0, consumers: false },
  { path: 'clients/desktop/app/config/typescript/tsconfig.tests.json', targets: 0, consumers: false },
  { path: 'tests/desktop/consumers/packages.test.ts', targets: 1, consumers: true },
  { path: 'tests/desktop/fixtures/consumers/node/consumer.ts', targets: 1, consumers: true },
  { path: 'clients/desktop/packages/ui/README.md', targets: 1, consumers: true },
  { path: 'clients/desktop/app/tests/browser/window.test.tsx', targets: 1, consumers: false },
  { path: '.github/workflows/verification-repository.yml', targets: 0, consumers: false, repositoryComplete: true },
  { path: '.github/workflows/verification-desktop.yml', targets: 6, consumers: true, desktopComplete: true },
  { path: '.github/workflows/verification.yml', targets: 6, consumers: true, desktopComplete: true, repositoryComplete: true },
  { path: '.github/workflows/ci.yml', targets: 6, consumers: true, desktopComplete: true, repositoryComplete: true },
  { path: 'config/turbo/verification.graphql', targets: 6, consumers: true, desktopComplete: true, repositoryComplete: true },
  { path: '.node-version', targets: 6, consumers: true, desktopComplete: true, repositoryComplete: true },
]
const observations = []
for (const item of cases) {
  const id = `case-${observations.length}`
  let head: string
  try {
    git(['read-tree', base], indexed)
    const content = git(['show', `${base}:${item.path}`]) + '\n\n'
    const blob = git(['hash-object', '-w', '--path', item.path, '--stdin'], indexed, content)
    git(['update-index', '--cacheinfo', `100644,${blob},${item.path}`], indexed)
    head = commit(git(['write-tree'], indexed), base, `Probe ${item.path}`)
  } finally { await rm(index, { force: true }) }
  const desktopScope = await select('desktop', id, head)
  const repositoryScope = await select('repository', id, head)
  assert.equal(desktopScope.complete, String(item.desktopComplete ?? false), item.path)
  assert.equal(repositoryScope.complete, String(item.repositoryComplete ?? false), item.path)
  assert.equal(desktopScope.consumers, String(item.consumers), item.path)
  assert.equal(JSON.parse(desktopScope.matrix).length, item.targets, item.path)
  if (item.targets === 1) assert.equal(JSON.parse(desktopScope.matrix)[0].target, 'linux-x64')
  const observation = { ...item, head, desktop: desktopScope, repository: repositoryScope }
  observations.push(observation)
  console.log(JSON.stringify({ path: item.path, desktopTargets: item.targets, consumers: item.consumers, passed: true }))
}

const synthetic = { data: { affectedTasks: { items: [{ name: 'check:package', fullName: '@kisaki3/web-fixture#check:package', command: 'check-web-package', package: { name: '@kisaki3/web-fixture', path: 'clients/web/packages/fixture' }, reason: { __typename: 'TaskInputChanged' } }] } } }
const report = `${directory}/foreign-package.json`
const output = `${directory}/foreign-selected.txt`
await writeFile(report, JSON.stringify(synthetic))
await writeFile(output, '')
await executeScript('foreign-package', `complete=false\nreport=${report}\n${selectors.desktop.run.slice(selectors.desktop.run.indexOf('platform=false'))}`, {
  TARGETS: selectors.desktop.env.TARGETS, GITHUB_OUTPUT: output,
})
const foreignScope = await readFile(output, 'utf8')
assert(foreignScope.includes('consumers=false\n') && foreignScope.includes('selected=false\n'))

const successful = { result: 'success', outputs: { selected: 'true', verified: 'true' } }
const skipped = { result: 'success', outputs: { selected: 'false', verified: '' } }
const gateCases = [
  { name: 'all-selected', pass: true, results: { repository: successful, desktop: successful } },
  { name: 'desktop-not-selected', pass: true, results: { repository: successful, desktop: skipped } },
  { name: 'additional-project', pass: true, results: { repository: successful, desktop: skipped, site: successful } },
  { name: 'additional-project-fails', pass: false, results: { repository: successful, desktop: skipped, site: { ...successful, result: 'failure' } } },
  { name: 'missing-completion', pass: false, results: { repository: successful, desktop: { result: 'success', outputs: { selected: 'true', verified: '' } } } },
  { name: 'unexpected-completion', pass: false, results: { repository: successful, desktop: { result: 'success', outputs: { selected: 'false', verified: 'true' } } } },
  { name: 'missing-selection', pass: false, results: { repository: successful, desktop: { result: 'success', outputs: {} } } },
  { name: 'unexpected-skip', pass: false, results: { repository: successful, desktop: { ...skipped, result: 'skipped' } } },
  { name: 'cancelled', pass: false, results: { repository: successful, desktop: { ...successful, result: 'cancelled' } } },
  { name: 'repository-fails', pass: false, results: { repository: { ...successful, result: 'failure' }, desktop: successful } },
]
for (const item of gateCases) {
  let passed = true
  try { await executeScript(`gate-${item.name}`, coordinator.jobs.required.steps[0].run, { PROJECT_RESULTS: JSON.stringify(item.results) }) }
  catch (cause) { assert.equal((cause as { code: number }).code, 1); passed = false }
  assert.equal(passed, item.pass, item.name)
}
assert.equal(git(['status', '--porcelain']), before)
const hashes = Object.fromEntries(Object.entries({ desktop: desktopText, repository: repositoryText, coordinator: coordinatorText }).map(([key, content]) => [key, createHash('sha256').update(content).digest('hex')]))
await writeFile(`${directory}/summary.json`, JSON.stringify({ parent, sourceSnapshot: base, workflowSha256: hashes, observations, foreignRouting: { input: synthetic, selected: foreignScope }, gateCases }, null, 2) + '\n')
console.log(JSON.stringify({ scopeCases: cases.length, foreignDomainIgnored: true, gateCases: gateCases.length, passed: true }))
