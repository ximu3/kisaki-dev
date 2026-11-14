#!/usr/bin/env node
/** @fileoverview Prepares public outputs and checks the tarball consumed by external package tests. */

import { createRequire } from 'node:module'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { publint } from 'publint'
import { formatMessage } from 'publint/utils'
import { runCli } from './cli.ts'
import { removeOutputs } from './output.ts'
import { run, runPnpm } from './process/index.ts'

/**
 * Creates the tarball consumed by package checks in a clean, disposable output directory.
 */
async function packPackage(project: string, signal: AbortSignal): Promise<void> {
  await removeOutputs(project, ['out/package'], signal)
  const directory = join(project, 'out/package')
  await mkdir(directory, { recursive: true })
  await runPnpm(['pack', '--out', join(directory, 'package.tgz')], { cwd: project, signal })
}

/**
 * Checks the prepared tarball with publint and the installed ATTW CLI.
 *
 * The caller prepares out/package/package.tgz first. Metadata diagnostics are printed, and failed
 * metadata or declaration checks reject the operation.
 */
async function checkPackage(project: string, signal: AbortSignal): Promise<void> {
  const archive = join(project, 'out/package/package.tgz')
  const bytes = await readFile(archive)
  const { messages, pkg } = await publint({
    pack: { tarball: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) },
    level: 'warning',
    strict: true,
  })
  for (const message of messages) {
    console.error(formatMessage(message, pkg))
  }
  if (messages.length) {
    throw new Error('Package metadata validation failed')
  }

  signal.throwIfAborted()
  /** Module-scoped resolver for the installed package-verification command entry points. */
  const require = createRequire(import.meta.url)
  const manifestPath = require.resolve('@arethetypeswrong/cli/package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as { bin: { attw: string } }
  await run(process.execPath, [join(dirname(manifestPath), manifest.bin.attw), archive], {
    cwd: project,
    signal,
  })
}

await runCli(async (signal) => {
  const { positionals } = parseArgs({ allowPositionals: true })
  if (positionals.length !== 1) {
    throw new Error('Usage: kisaki-package <clean|pack|check>')
  }

  const operation = positionals[0]
  if (operation === 'clean') {
    await removeOutputs(process.cwd(), ['dist', 'out'], signal)
  } else if (operation === 'pack') {
    await packPackage(process.cwd(), signal)
  } else if (operation === 'check') {
    await checkPackage(process.cwd(), signal)
  } else {
    throw new Error('Usage: kisaki-package <clean|pack|check>')
  }
})
