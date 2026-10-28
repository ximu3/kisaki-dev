import { writeFile, realpath } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import { prepareDevelopmentWorkspace } from '../../clients/desktop/app/tests/support/development-workspace'
import { readPnpm, run } from '../../packages/tooling/src/process'

const destination = 'F:/project/kisaki/refactor/verification/evidence/ci-exploration/2026-10-27'
const workspace = await prepareDevelopmentWorkspace()
const phases: object[] = []
try {
  const modes = process.argv.length > 2 ? process.argv.slice(2) : ['copied-directory', 'git-initialized']
  for (const mode of modes) {
    if (mode.startsWith('git-')) await run('git', ['init', '--quiet'], { cwd: workspace.root })
    if (mode === 'git-committed') await run('git', ['-c', 'user.name=Kisaki fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '--quiet', '-m', 'test: initialize isolated fixture'], { cwd: workspace.root })
    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await readPnpm(['exec', 'turbo', 'run', 'build', '--filter=@kisaki3/desktop^...', '--dry=json'], workspace.root)
      const report = JSON.parse(raw)
      await writeFile(join(destination, `cache-inputs-${mode}-${attempt}.json`), JSON.stringify(report, null, 2) + '\n')
      console.log(JSON.stringify({ mode, attempt, hashes: report.tasks.map(({ taskId, hash }: { taskId: string; hash: string }) => ({ taskId, hash })) }))
      if (attempt === 2) break
      const start = performance.now()
      const output = await readPnpm(['exec', 'turbo', 'run', 'build', '--filter=@kisaki3/desktop^...'], workspace.root)
      const phase = { mode, attempt, elapsedMs: performance.now() - start, output }
      phases.push(phase)
      console.log(JSON.stringify(phase))
    }
  }
} finally {
  await writeFile(join(destination, 'cache-inputs-builds.json'), JSON.stringify({ platform: process.platform, arch: process.arch, node: process.version, phases }, null, 2) + '\n')
  const resolved = await realpath(workspace.root)
  assert.equal(dirname(resolved), await realpath(tmpdir()))
  assert.ok(basename(resolved).startsWith('kisaki-dev-workspace-'))
  await workspace.close()
}
