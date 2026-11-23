import { build, loadConfigFromFile, type InlineConfig } from 'vite-plus'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

export const programNames = ['main', 'preload', 'extension-host', 'renderer'] as const
export type ProgramName = (typeof programNames)[number]

/** Includes a utility process when the input supplies that independently delivered program. */
export function sourcePrograms(root: string) {
  return programNames.filter(
    (name) => name !== 'extension-host' || existsSync(join(root, 'src/extension-host/entry.ts')),
  )
}

export function programConfig(
  sourceRoot: string,
  program: ProgramName,
  outputDirectory: string,
  buildId: string,
  mode: 'development' | 'production',
): InlineConfig & { configFile: string } {
  return {
    configFile: join(sourceRoot, 'config', 'vite', `${program}.ts`),
    root: program === 'renderer' ? join(sourceRoot, 'src', 'renderer', 'windows') : sourceRoot,
    mode,
    define: { __KISAKI_BUILD_ID__: JSON.stringify(buildId) },
    build: { outDir: outputDirectory, emptyOutDir: true },
  }
}

/** Resolves current program entries, giving each sandbox preload its own self-contained build. */
export async function programConfigurations(
  sourceRoot: string,
  program: ProgramName,
  outputDirectory: string,
  buildId: string,
  mode: 'development' | 'production',
): Promise<InlineConfig[]> {
  const config = programConfig(sourceRoot, program, outputDirectory, buildId, mode)
  if (program !== 'preload') {
    return [config]
  }

  const loaded = await loadConfigFromFile({ command: 'build', mode }, config.configFile, sourceRoot)
  const library = loaded?.config.build?.lib
  if (!library || typeof library.entry !== 'object' || Array.isArray(library.entry)) {
    throw new Error('Preload configuration must provide named entries')
  }

  return Object.entries(library.entry).map(([name, entry], index) => ({
    ...config,
    build: {
      ...config.build,
      emptyOutDir: index === 0,
      lib: {
        ...library,
        entry,
        fileName: () => `${name}.cjs`,
      },
    },
  }))
}

export async function buildProgram(
  sourceRoot: string,
  program: ProgramName,
  outputDirectory: string,
  buildId: string,
  mode: 'development' | 'production' = 'production',
): Promise<void> {
  for (const config of await programConfigurations(
    sourceRoot,
    program,
    outputDirectory,
    buildId,
    mode,
  )) {
    await build({
      ...config,
      build: { ...config.build, watch: null },
    })
  }
}
