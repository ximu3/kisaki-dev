import { AsyncLocalStorage } from 'node:async_hooks'
import { createRequire } from 'node:module'
import { createHash, randomUUID } from 'node:crypto'
import { fstatSync, statSync } from 'node:fs'
import { mkdir, open, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import type * as NativeFileSystem from './fs-native-extensions'

const require = createRequire(import.meta.url)
const { tryLock }: typeof NativeFileSystem = require('fs-native-extensions')

export const accessVariable = 'KISAKI_OUTPUT_ACCESS'
export const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const active = new AsyncLocalStorage<AccessContext>()

/** Project cleanup excludes every ordinary user; ordinary operations declare their output roots. */
export type OutputRequest =
  | { project: string; mode: 'clean' }
  | { project: string; mode: 'use'; read?: readonly string[]; write?: readonly string[] }

/** Waiting is opt-in; cancellation is honored before any output operation begins. */
export interface AccessOptions {
  root?: string
  signal?: AbortSignal
  wait?: boolean
  onWaiting?: (path: string) => void
}

/** A retained access scope, used by development sessions until their readers and children close. */
export interface OutputAccess {
  run<T>(action: (signal: AbortSignal) => Promise<T>): Promise<T>
  /** Cancel outstanding owned commands, wait for their closure, then release this scope. */
  close(): Promise<void>
}

interface Claim {
  project: string
  output?: string
  mode: 'read' | 'write'
}

interface Descriptor {
  fd: number
  path: string
}

interface AccessContext {
  root: string
  claims: readonly Claim[]
  scopes: readonly string[]
  descriptors: readonly Descriptor[]
  signal: AbortSignal
  children: Set<Promise<void>>
}

/** A conflicting output has not been read or modified by the rejected operation. */
export class OutputInUse extends Error {
  readonly code = 'OUTPUT_IN_USE'
  constructor(path: string) {
    super(`Output is in use: ${path}`)
  }
}

/** Get the active ownership used by the process adapter; private to this engineering boundary. */
export function currentAccess(): AccessContext | undefined {
  return active.getStore()
}

function childOf(parent: string, path: string): boolean {
  const child = relative(parent, path)
  return child !== '' && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child)
}

function identity(claim: Claim): string {
  const path = claim.output ?? claim.project
  const normalized = process.platform === 'win32' ? path.toLowerCase() : path
  return `${claim.output ? '1:output' : '0:project'}:${normalized}`
}

/** Normalize owners and merge repeated read/write requests before touching lock carriers. */
async function claimsFor(requests: readonly OutputRequest[], root: string): Promise<Claim[]> {
  const claims = new Map<string, Claim>()
  const add = (claim: Claim) => {
    const key = identity(claim)
    if (claims.get(key)?.mode !== 'write') claims.set(key, claim)
  }
  for (const request of requests) {
    const suppliedProject = resolve(request.project)
    const project = await realpath(suppliedProject)
    if (project !== root && !childOf(root, project)) {
      throw new Error('Project is outside the workspace')
    }
    add({ project, mode: request.mode === 'clean' ? 'write' : 'read' })
    if (request.mode === 'clean') continue
    for (const mode of ['read', 'write'] as const) {
      for (const name of request[mode] ?? []) {
        const suppliedOutput = resolve(suppliedProject, name)
        if (!childOf(suppliedProject, suppliedOutput)) {
          throw new Error('Output is outside its project')
        }
        const output = resolve(project, relative(suppliedProject, suppliedOutput))
        add({ project, output, mode })
      }
    }
  }
  return [...claims.values()].sort((a, b) => identity(a).localeCompare(identity(b), 'en'))
}

/** A parent's exclusive project or output scope also permits the corresponding nested reads. */
function covered(request: Claim, held: readonly Claim[]): boolean {
  for (const claim of held) {
    if (claim.project !== request.project) continue
    if (!claim.output) {
      if (claim.mode === 'write') return true
      if (!request.output) {
        if (request.mode === 'write') {
          throw new Error('Cannot upgrade an active project shared lock')
        }
        return true
      }
      continue
    }
    if (!request.output) continue
    if (claim.output !== request.output && !childOf(claim.output, request.output)) continue
    if (claim.mode === 'read' && request.mode === 'write') {
      throw new Error('Declare output writes before entering a shared output scope')
    }
    return true
  }
  return false
}

/** Read generated scope metadata only while its system-owned carrier is still locked. */
async function inheritedAccess(
  root: string,
): Promise<Pick<AccessContext, 'claims' | 'scopes' | 'descriptors'>> {
  const encoded = process.env[accessVariable]
  if (!encoded) return { claims: [], scopes: [], descriptors: [] }
  const value: unknown = JSON.parse(encoded)
  if (!value || typeof value !== 'object' || !('root' in value) || typeof value.root !== 'string') {
    throw new Error('Invalid inherited output access')
  }
  if (value.root !== root) return { claims: [], scopes: [], descriptors: [] }
  if (
    !('scopes' in value) ||
    !Array.isArray(value.scopes) ||
    !('descriptors' in value) ||
    !Array.isArray(value.descriptors)
  ) {
    throw new Error('Invalid inherited output access')
  }
  const scopes: string[] = []
  const descriptors: Descriptor[] = []
  const claims: Claim[] = []
  const directory = join(root, '.cache', 'output-locks')

  // External task runners may close extra descriptors; only forward descriptors that still match.
  for (const item of value.descriptors) {
    if (
      !item ||
      typeof item !== 'object' ||
      !('fd' in item) ||
      typeof item.fd !== 'number' ||
      !Number.isInteger(item.fd) ||
      item.fd < 3 ||
      !('path' in item) ||
      typeof item.path !== 'string' ||
      !childOf(directory, item.path)
    ) {
      throw new Error('Invalid inherited lock descriptor')
    }
    try {
      const descriptor = fstatSync(item.fd, { bigint: true })
      const expected = statSync(item.path, { bigint: true })
      if (
        descriptor.isFile() &&
        descriptor.dev === expected.dev &&
        descriptor.ino === expected.ino
      ) {
        descriptors.push({ fd: item.fd, path: item.path })
      }
    } catch (cause) {
      if (!['EBADF', 'ENOENT', 'EINVAL'].includes((cause as NodeJS.ErrnoException).code ?? '')) {
        throw cause
      }
    }
  }
  for (const id of value.scopes) {
    if (typeof id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) {
      throw new Error('Invalid inherited output scope')
    }
    const carrier = await open(join(directory, 'scopes', `${id}.lock`), 'r+')
    try {
      if (tryLock(carrier.fd)) throw new Error('Inherited output scope has ended')
      const record: unknown = JSON.parse(
        await readFile(join(directory, 'scopes', `${id}.json`), 'utf8'),
      )
      if (!Array.isArray(record)) throw new Error('Invalid output scope metadata')
      for (const item of record) {
        if (
          !item ||
          typeof item !== 'object' ||
          !('project' in item) ||
          typeof item.project !== 'string' ||
          (item.project !== root && !childOf(root, item.project)) ||
          !('mode' in item) ||
          !['read', 'write'].includes(item.mode) ||
          ('output' in item &&
            (typeof item.output !== 'string' || !childOf(item.project, item.output)))
        ) {
          throw new Error('Invalid output scope metadata')
        }
        claims.push(item as Claim)
      }
      scopes.push(id)
    } finally {
      await carrier.close()
    }
  }
  return { claims, scopes, descriptors }
}

/** Open a complete set in stable order; release partial acquisitions before waiting or rejecting. */
async function lockClaims(
  claims: readonly Claim[],
  root: string,
  options: AccessOptions,
  signal: AbortSignal,
): Promise<{ file: FileHandle; path: string }[]> {
  const directory = join(root, '.cache', 'output-locks')
  await mkdir(directory, { recursive: true })
  let announced = false
  while (true) {
    signal.throwIfAborted()
    const held: { file: FileHandle; path: string }[] = []
    let busy: Claim | undefined
    try {
      for (const claim of claims) {
        const key = createHash('sha256').update(identity(claim)).digest('hex')
        const path = join(directory, `${key}.lock`)
        const file = await open(path, 'a+')
        held.push({ file, path })
        if (!tryLock(file.fd, { shared: claim.mode === 'read' })) {
          busy = claim
          break
        }
      }
      if (!busy) return held
    } catch (cause) {
      for (const item of held.reverse()) await item.file.close()
      throw cause
    }
    for (const item of held.reverse()) await item.file.close()
    const path = busy.output ?? busy.project
    if (!options.wait) throw new OutputInUse(path)
    if (!announced) {
      announced = true
      options.onWaiting?.(path)
    }
    // Upstream's blocking wait is not cancellable; this polling interval is not an owner timeout.
    await delay(50, undefined, { signal })
  }
}

/** Acquire project and output locks for one operation or a retained development-session lifetime. */
export async function acquireOutputs(
  requests: readonly OutputRequest[],
  options: AccessOptions = {},
): Promise<OutputAccess> {
  const parent = currentAccess()
  const root = await realpath(options.root ?? parent?.root ?? repositoryRoot)
  const lifetime = new AbortController()
  const signals = [lifetime.signal]
  if (options.signal) signals.push(options.signal)
  if (parent?.root === root) signals.push(parent.signal)
  const signal = AbortSignal.any(signals)
  signal.throwIfAborted()
  const inherited = parent?.root === root ? parent : await inheritedAccess(root)
  const requested = await claimsFor(requests, root)
  const needed = requested.filter((claim) => !covered(claim, inherited.claims))
  const held = await lockClaims(needed, root, options, signal)
  let carrier: FileHandle | undefined
  let id: string | undefined
  const directory = join(root, '.cache', 'output-locks', 'scopes')
  try {
    if (needed.length) {
      await mkdir(directory, { recursive: true })
      id = randomUUID()
      carrier = await open(join(directory, `${id}.lock`), 'wx+')
      if (!tryLock(carrier.fd)) throw new Error('Unable to establish output scope')
      await writeFile(join(directory, `${id}.json`), JSON.stringify(needed))
    }
  } catch (cause) {
    await carrier?.close()
    for (const item of held.reverse()) await item.file.close()
    throw cause
  }
  const context: AccessContext = {
    root,
    signal,
    claims: [...inherited.claims, ...needed],
    scopes: [...inherited.scopes, ...(id ? [id] : [])],
    descriptors: [
      ...inherited.descriptors,
      ...held.map(({ file, path }) => ({ fd: file.fd, path })),
      ...(carrier && id ? [{ fd: carrier.fd, path: join(directory, `${id}.lock`) }] : []),
    ],
    children: new Set(),
  }
  let closing: Promise<void> | undefined
  return {
    run(action) {
      signal.throwIfAborted()
      return active.run(context, () => action(signal))
    },
    close() {
      closing ??= (async () => {
        lifetime.abort(new Error('Output access closed'))
        await Promise.all(context.children)
        try {
          await carrier?.close()
        } finally {
          for (const item of held.reverse()) await item.file.close()
        }
        if (id) {
          await rm(join(directory, `${id}.json`), { force: true })
          await rm(join(directory, `${id}.lock`), { force: true })
        }
      })()
      return closing
    },
  }
}

/** Hold all declared access through the complete operation and its owned child-process closure. */
export async function withOutputs<T>(
  requests: readonly OutputRequest[],
  action: (signal: AbortSignal) => Promise<T>,
  options: AccessOptions = {},
): Promise<T> {
  const access = await acquireOutputs(requests, options)
  try {
    return await access.run(action)
  } finally {
    await access.close()
  }
}

/** Export this scope and share its open descriptors through Node's public stdio mechanism. */
export function childAccess(firstDescriptor: number): {
  env: NodeJS.ProcessEnv
  descriptors: number[]
  signal?: AbortSignal
} {
  const context = currentAccess()
  if (!context) return { env: {}, descriptors: [] }
  context.signal.throwIfAborted()
  const descriptors = [...new Map(context.descriptors.map((item) => [item.fd, item])).values()]
  return {
    env: {
      [accessVariable]: JSON.stringify({
        root: context.root,
        scopes: context.scopes,
        descriptors: descriptors.map((item, index) => ({
          fd: firstDescriptor + index,
          path: item.path,
        })),
      }),
    },
    descriptors: descriptors.map((item) => item.fd),
    signal: context.signal,
  }
}

/** Retain actual process closure in the scope that spawned it. */
export function ownChild(completion: Promise<void>): void {
  const context = currentAccess()
  if (!context) return
  context.children.add(completion)
  void completion.finally(() => context.children.delete(completion))
}
