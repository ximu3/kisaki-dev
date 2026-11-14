/** @fileoverview Configures and compiles desktop programs through Vite's public build API. */

import { build, loadConfigFromFile } from 'vite'
import type { InlineConfig } from 'vite'
import { join } from 'node:path'

/** Independently compiled desktop programs with separate runtime environments. */
export const programNames = ['main', 'preload', 'extension-host', 'renderer'] as const
/** Identity of one independently compiled desktop runtime program. */
export type ProgramName = (typeof programNames)[number]

/** Creates a program's Vite configuration with its output directory and shared build identity. */
export function programConfig(
  sourceRoot: string,
  program: ProgramName,
  outputDirectory: string,
  buildId: string,
  mode: 'development' | 'production',
): InlineConfig & { configFile: string } {
  return {
    configFile: join(sourceRoot, 'config', 'vite', `vite.config.${program}.ts`),
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
        /** Keeps this sandbox preload in its declared single-file CommonJS entry. */
        fileName: () => `${name}.cjs`,
      },
    },
  }))
}

/** Compiles the current program entries and waits for all finite output writes to finish. */
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
