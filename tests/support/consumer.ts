import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { PackageInputs } from '../../tools/release/package-inputs'
import { t as readTar } from 'tar'
import { satisfies } from 'semver'
import { stringify } from 'yaml'

/** Run pnpm in the isolated consumer and return its standard output. */
export async function consumerCommand(directory: string, args: string[]): Promise<string> {
  const pnpm = process.env.npm_execpath
  if (!pnpm) throw new Error('Run consumer verification through pnpm test:consumers')

  try {
    const command = pnpm.endsWith('.exe') ? pnpm : process.execPath
    const commandArguments = pnpm.endsWith('.exe') ? args : [pnpm, ...args]
    const result = await promisify(execFile)(command, commandArguments, {
      cwd: directory,
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
    })
    return result.stdout
  } catch (cause) {
    const failure = cause as { stdout?: string; stderr?: string }
    throw new Error(
      `Consumer command failed:\n${`${failure.stdout ?? ''}\n${failure.stderr ?? ''}`.slice(-8_192)}`,
      { cause },
    )
  }
}

/** Install exact supplied tarballs in an unrelated temporary project, with its own lockfile. */
export async function prepareConsumer(): Promise<{
  directory: string
  inputs: PackageInputs
  close(): Promise<void>
}> {
  const receipt = process.env.KISAKI_PACKAGE_INPUTS ?? resolve('artifacts/packages/inputs.json')
  const inputs: PackageInputs = JSON.parse(await readFile(receipt, 'utf8'))
  if (inputs.packages.length !== 8 || !/^[a-f0-9]{64}$/.test(inputs.buildId)) {
    throw new Error('Invalid package input receipt')
  }

  const dependencies: Record<string, string> = { 'solid-js': '1.9.16' }
  const overrides: Record<string, string> = {}
  const versions = new Map(inputs.packages.map((input) => [input.name, input.version]))
  for (const input of inputs.packages) {
    if (!/^[a-z0-9-]+\.tgz$/.test(input.path)) throw new Error('Unsafe package input path')
    const archive = join(dirname(receipt), input.path)
    if (
      createHash('sha256')
        .update(await readFile(archive))
        .digest('hex') !== input.sha256
    ) {
      throw new Error('Consumer tarball checksum mismatch')
    }

    const location = `file:${archive.replaceAll('\\', '/')}`
    dependencies[input.name] = location
    overrides[input.name] = location

    let text = ''
    await readTar({
      file: archive,
      onReadEntry(entry) {
        if (entry.path === 'package/package.json') {
          entry.on('data', (chunk: Buffer) => {
            text += chunk.toString()
          })
        }
      },
    })

    const manifest: {
      name: string
      version: string
      dependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
    } = JSON.parse(text)
    if (manifest.name !== input.name || manifest.version !== input.version) {
      throw new Error('Tarball identity mismatch')
    }

    for (const [name, range] of Object.entries({
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
      ...manifest.peerDependencies,
    })) {
      if (!name.startsWith('@kisaki3/')) continue
      const version = versions.get(name)
      if (!version || !satisfies(version, range)) {
        throw new Error(`Consumer input does not satisfy ${name}@${range}`)
      }
    }
  }

  const directory = await mkdtemp(join(tmpdir(), 'kisaki-consumer-'))
  try {
    await cp(resolve('tests/fixtures/consumers'), directory, { recursive: true })

    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify(
        {
          name: 'kisaki-external-consumer',
          private: true,
          type: 'module',
          packageManager: 'pnpm@11.11.0',
          scripts: {
            typecheck:
              'tsc -p node/tsconfig.json && tsc -p webview/tsconfig.json && tsc -p solid/tsconfig.json && tsc -p config/typescript/tsconfig.tools.json',
            build: 'vite build',
            node: 'tsx node/consumer.ts',
          },
          dependencies,
          devDependencies: {
            typescript: '6.0.3',
            '@types/node': '24.19.2',
            tsx: '4.23.15',
            vite: '8.3.3',
            'vite-plugin-solid': '2.11.14',
          },
        },
        null,
        2,
      ),
    )
    // Unpublished packages resolve to these tarballs after their declared version ranges are checked.
    await writeFile(
      join(directory, 'pnpm-workspace.yaml'),
      stringify({ packages: ['.'], autoInstallPeers: false, overrides }),
    )

    await consumerCommand(directory, ['install', '--ignore-scripts', '--prefer-offline'])
    for (const input of inputs.packages) {
      const installed: { name: string; version: string } = JSON.parse(
        await readFile(join(directory, 'node_modules', input.name, 'package.json'), 'utf8'),
      )
      if (installed.name !== input.name || installed.version !== input.version) {
        throw new Error('Installed consumer input identity mismatch')
      }
    }

    return {
      directory,
      inputs,
      close: () => rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
    }
  } catch (cause) {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    throw cause
  }
}
