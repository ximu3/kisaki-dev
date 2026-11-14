/** @fileoverview Locates the native compiler installed by the workspace's TypeScript release. */

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

/** Resolves the platform package from TypeScript itself, including pnpm's isolated installs. */
export function typescriptExecutable(): string {
  const compiler = createRequire(import.meta.resolve('typescript/package.json'))
  const platform = compiler.resolve(
    `@typescript/typescript-${process.platform}-${process.arch}/package.json`,
  )
  return join(dirname(platform), 'lib', process.platform === 'win32' ? 'tsc.exe' : 'tsc')
}
