/**
 * @fileoverview Collects the eight desktop package tarballs into a portable input receipt
 * for isolated consumers.
 */

import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readPnpm } from '@kisaki3/tooling/process'
import { runCli } from '@kisaki3/tooling/cli'

const root = fileURLToPath(new URL('../..', import.meta.url))

/** A tarball selected for consumer testing, identified by package version and digest. */
export interface DesktopPackageInput {
  name: string
  version: string
  /** Tarball file name relative to the directory containing this input receipt. */
  path: string
  sha256: string
}

/** A portable set of already-packed files with a common content identity. */
export interface DesktopPackageInputs {
  buildId: string
  lockfileSha256: string
  packages: DesktopPackageInput[]
}

/** Copy the built tarballs to the artifact directory and write their completed input receipt. */
export async function collectDesktopPackageInputs(signal?: AbortSignal): Promise<string> {
  const args = ['list', '--filter', './clients/desktop/packages/*', '--depth', '-1', '--json']
  const stdout = await readPnpm(args, root, { signal })
  const members = JSON.parse(stdout) as { name: string; path: string }[]
  if (members.length !== 8) {
    throw new Error('Expected the eight public desktop packages')
  }

  const output = join(root, 'artifacts', 'desktop', 'packages')
  await mkdir(output, { recursive: true })

  const packages: DesktopPackageInput[] = []
  for (const member of members.sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    if (!/^@kisaki3\/[a-z0-9-]+$/.test(member.name)) {
      throw new Error('Unexpected public package identity')
    }

    const manifest = JSON.parse(await readFile(join(member.path, 'package.json'), 'utf8')) as {
      name: string
      version: string
    }
    if (manifest.name !== member.name) {
      throw new Error('Workspace package identity changed')
    }

    signal?.throwIfAborted()
    const archive = join(member.path, 'out', 'package.tgz')
    const digest = createHash('sha256')
      .update(await readFile(archive))
      .digest('hex')

    const path = `${member.name.slice('@kisaki3/'.length)}-${digest}.tgz`
    await copyFile(archive, join(output, path))
    packages.push({ name: member.name, version: manifest.version, path, sha256: digest })
  }

  const lockfileSha256 = createHash('sha256')
    .update(await readFile(join(root, 'pnpm-lock.yaml')))
    .digest('hex')
  const buildId = createHash('sha256')
    .update(JSON.stringify({ lockfileSha256, packages }))
    .digest('hex')

  const inputs: DesktopPackageInputs = { buildId, lockfileSha256, packages }
  signal?.throwIfAborted()
  const temporary = join(output, `inputs.${process.pid}.json`)
  try {
    await writeFile(temporary, JSON.stringify(inputs, null, 2))
    signal?.throwIfAborted()
    await rename(temporary, join(output, 'inputs.json'))
  } catch (cause) {
    try {
      await rm(temporary, { force: true })
    } catch (cleanupFailure) {
      throw new AggregateError([cause, cleanupFailure], 'Package receipt and cleanup failed', {
        cause: cleanupFailure,
      })
    }
    throw cause
  }

  return join(output, 'inputs.json')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runCli(async (signal) => {
    console.info(await collectDesktopPackageInputs(signal))
  })
}
