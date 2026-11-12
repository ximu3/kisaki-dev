/**
 * @fileoverview Compiles desktop programs with their Vite configurations and records the
 * source modules used by the compiler.
 */

import { build, loadConfigFromFile } from 'vite'
import type { InlineConfig } from 'vite'
import { isAbsolute, join } from 'node:path'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'

/** Independently compiled desktop programs with separate runtime environments. */
export const programNames = ['main', 'preload', 'extension-host', 'renderer'] as const
/** Identity of one independently compiled desktop runtime program. */
export type ProgramName = (typeof programNames)[number]

/** Absolute compiler module IDs retained for development input tracking. */
export interface ProgramBuild {
  modules: string[]
}

/** Creates the shared finite-build configuration for a desktop program and output directory. */
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
    plugins: [
      {
        name: 'desktop-finite-build',
        /** Rejects watch mode so the finite build can settle and release output ownership. */
        configResolved(config) {
          if (config.build.watch) {
            throw new Error('Finite program builds do not support watch mode')
          }
        },
      },
    ],
  }
}

/**
 * Compiles a complete program into its caller-owned candidate directory.
 *
 * Builds preload entries separately as CommonJS files. Returns the absolute module IDs reported by
 * the completed builds.
 */
export async function buildProgram(
  sourceRoot: string,
  program: ProgramName,
  outputDirectory: string,
  buildId: string,
  mode: 'development' | 'production' = 'production',
): Promise<ProgramBuild> {
  const config = programConfig(sourceRoot, program, outputDirectory, buildId, mode)
  const modules = new Set<string>()

  /**
   * Compiles one Vite configuration and records absolute module IDs.
   *
   * An unexpected watcher is closed before its finite-build failure is reported.
   */
  async function compile(options: InlineConfig): Promise<void> {
    const result = await build(options)
    const bundles = Array.isArray(result) ? result : [result]

    for (const bundle of bundles) {
      if (!('output' in bundle)) {
        return rethrowAfterCleanup(
          new Error('A finite program build returned a watcher'),
          () => bundle.close(),
          'Unexpected build watcher cleanup failed',
        )
      }

      for (const chunk of bundle.output) {
        if (chunk.type !== 'chunk') {
          continue
        }

        for (const path of Object.keys(chunk.modules)) {
          if (isAbsolute(path)) {
            modules.add(path)
          }
        }
      }
    }
  }

  if (program !== 'preload') {
    await compile(config)

    return { modules: [...modules] }
  }

  const loaded = await loadConfigFromFile({ command: 'build', mode }, config.configFile, sourceRoot)
  const library = loaded?.config.build?.lib
  if (!library || typeof library.entry !== 'object' || Array.isArray(library.entry)) {
    throw new Error('Preload configuration must provide named entries')
  }

  let first = true
  for (const [name, entry] of Object.entries(library.entry)) {
    await compile({
      ...config,
      build: {
        ...config.build,
        emptyOutDir: first,
        lib: { entry, fileName: () => `${name}.cjs` },
      },
    })
    first = false
  }

  return { modules: [...modules] }
}
