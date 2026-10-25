import { runCli, runTurbo } from './index'

await runCli(async (signal) => {
  const args = process.argv.slice(2)
  if (args.length === 0) throw new Error('A Turbo command is required')
  await runTurbo(args, { signal })
})
