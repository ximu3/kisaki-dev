import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('../..', import.meta.url))

/** A tarball selected for consumer testing, identified by package version and digest. */
export interface PackageInput {
  name: string
  version: string
  path: string
  sha256: string
}

/** A portable set of already-packed files with a common content identity. */
export interface PackageInputs {
  buildId: string
  lockfileSha256: string
  packages: PackageInput[]
}

/** Copy the built tarballs to the artifact directory and write their completed input receipt. */
export async function collectPackageInputs(): Promise<string> {
  const pnpm = process.env.npm_execpath
  if (!pnpm) throw new Error('Run package preparation through its pnpm task')

  const command = pnpm.endsWith('.exe') ? pnpm : process.execPath
  const args = ['list', '--filter', './clients/desktop/packages/*', '--depth', '-1', '--json']
  const commandArguments = pnpm.endsWith('.exe') ? args : [pnpm, ...args]
  const { stdout } = await promisify(execFile)(command, commandArguments, {
    cwd: root,
    windowsHide: true,
  })
  const members: { name: string; path: string }[] = JSON.parse(stdout)
  if (members.length !== 8) throw new Error('Expected the eight public desktop packages')

  const output = join(root, 'artifacts', 'packages')
  await mkdir(output, { recursive: true })
  const packages: PackageInput[] = []
  for (const member of members.sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    if (!/^@kisaki3\/[a-z0-9-]+$/.test(member.name)) {
      throw new Error('Unexpected public package identity')
    }
    const manifest: { name: string; version: string } = JSON.parse(
      await readFile(join(member.path, 'package.json'), 'utf8'),
    )
    if (manifest.name !== member.name) throw new Error('Workspace package identity changed')

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

  const inputs: PackageInputs = { buildId, lockfileSha256, packages }
  const temporary = join(output, `inputs.${process.pid}.json`)
  await writeFile(temporary, JSON.stringify(inputs, null, 2))
  await rename(temporary, join(output, 'inputs.json'))
  return join(output, 'inputs.json')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.info(await collectPackageInputs())
  } catch (cause) {
    console.error(cause)
    process.exitCode = 1
  }
}
