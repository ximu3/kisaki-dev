import { build } from 'vite-plus'
import { join } from 'node:path'

export async function buildProbe(profile: string, source: string) {
  const output = join(profile, 'probe')
  await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      ssr: true,
      outDir: output,
      lib: {
        entry: join(import.meta.dirname, source),
        formats: ['cjs'],
        fileName: () => 'runtime.cjs',
      },
      rolldownOptions: {
        external: [/^node:/, 'electron'],
        output: { format: 'cjs', entryFileNames: 'runtime.cjs' },
      },
    },
    ssr: { noExternal: true },
  })
  return join(output, 'runtime.cjs')
}
