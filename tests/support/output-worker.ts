import { join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { withOutputs, runCli, spawnWithOutputs } from '../../tools/outputs'

const [root, role = 'hold'] = process.argv.slice(2)
if (!root) throw new Error('The isolated workspace is required')
if (role === 'independent') delete process.env.KISAKI_OUTPUT_ACCESS

await runCli(async (signal) => {
  await withOutputs(
    [{ project: join(root, 'project'), mode: 'use', write: ['dist'] }],
    async () => {
      process.send?.({ ready: true })
      if (role === 'leaf') await writeFile(join(root, 'leaf.pid'), String(process.pid))
      if (role === 'tree') {
        spawnWithOutputs(
          process.execPath,
          [...process.execArgv, fileURLToPath(import.meta.url), root, 'leaf'],
          { stdio: 'ignore' },
        )
        let leaf: string | undefined
        while (leaf === undefined) {
          signal.throwIfAborted()
          try {
            leaf = await readFile(join(root, 'leaf.pid'), 'utf8')
          } catch (cause) {
            if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause
            await delay(10, undefined, { signal })
          }
        }
        await writeFile(
          join(root, 'tree.json'),
          JSON.stringify({ parent: process.pid, leaf: Number(leaf) }),
        )
      }
      if (!['hold', 'leaf', 'tree'].includes(role)) return
      await new Promise<void>((resolve) => {
        const timer = setInterval(() => undefined, 1_000)
        const stop = () => {
          clearInterval(timer)
          signal.removeEventListener('abort', stop)
          process.off('message', stop)
          resolve()
        }
        signal.addEventListener('abort', stop, { once: true })
        process.once('message', stop)
      })
    },
    { root, signal },
  )
})
