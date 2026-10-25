import { build } from 'tsdown'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { replaceOutput, runCli, runPnpm, withProjectOutputs } from '../../../../../tools/outputs'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Build code, declarations and styles while retaining dependency and published-output ownership. */
export async function buildPackage(signal?: AbortSignal): Promise<void> {
  await withProjectOutputs(
    root,
    { write: ['dist'] },
    async () => {
      await replaceOutput(root, 'dist', async (candidate) => {
        await build({ config: join(root, 'tsdown.config.ts'), outDir: candidate, clean: true })
        await runPnpm(
          [
            'exec',
            'tailwindcss',
            '-i',
            'src/styles.css',
            '-o',
            join(candidate, 'styles.css'),
            '--minify',
          ],
          { cwd: root },
        )
      })
    },
    signal ? { signal } : {},
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli((signal) => buildPackage(signal))
}
