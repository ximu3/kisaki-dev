import { parseArgs } from 'node:util'
import { runCli, runPnpm, withOutputs, dependencyRequests, workspaceProjects } from './index'

await runCli(async (signal) => {
  const { values, positionals } = parseArgs({
    options: {
      read: { type: 'string', multiple: true },
      write: { type: 'string', multiple: true },
      clean: { type: 'boolean', default: false },
      dependencies: { type: 'boolean', default: false },
      'read-packages': { type: 'boolean', default: false },
    },
    allowPositionals: true,
  })
  if (positionals.length === 0) throw new Error('A pnpm command is required')
  const project = process.cwd()
  const action = () => runPnpm(positionals, { cwd: project })
  if (values.clean) {
    if (values.read || values.write || values.dependencies || values['read-packages']) {
      throw new Error('Cleanup owns the whole project output scope')
    }
    await withOutputs([{ project, mode: 'clean' }], action, { signal })
  } else {
    const outputs = {
      ...(values.read ? { read: values.read } : {}),
      ...(values.write ? { write: values.write } : {}),
    }
    const dependencies = values.dependencies ? await dependencyRequests(project, { signal }) : []
    const packages = values['read-packages']
      ? (await workspaceProjects('./clients/desktop/packages/*', { signal })).map((member) => ({
          project: member.path,
          mode: 'use' as const,
          read: ['dist'],
        }))
      : []
    await withOutputs(
      [{ project, mode: 'use', ...outputs }, ...dependencies, ...packages],
      action,
      { signal },
    )
  }
})
