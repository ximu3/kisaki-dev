#!/usr/bin/env -S node --import tsx
/** @fileoverview Packs one project and checks the exact tarball consumed by external tests. */

import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { publint } from 'publint'
import { formatMessage } from 'publint/utils'
import { runCli } from './cli'
import { replaceOutput } from './output'
import { run, runPnpm } from './process'

/** Replace the project's archive only after pnpm has finished writing it. */
async function packPackage(project: string, signal: AbortSignal): Promise<void> {
  await replaceOutput(
    project,
    'out/package',
    async (candidate) => {
      await runPnpm(['pack', '--out', join(candidate, 'package.tgz')], { cwd: project, signal })
    },
    signal,
  )
}

/** Inspect the prepared tarball with publint and the installed ATTW CLI, without repacking. */
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
    throw new Error('Usage: kisaki-package <pack|check>')
  }
  const operation = positionals[0]
  if (operation === 'pack') {
    await packPackage(process.cwd(), signal)
  } else if (operation === 'check') {
    await checkPackage(process.cwd(), signal)
  } else {
    throw new Error('Usage: kisaki-package <pack|check>')
  }
})
