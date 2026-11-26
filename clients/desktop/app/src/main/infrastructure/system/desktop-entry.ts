import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'

async function readRegistration(path: string) {
  try {
    return await readFile(path, 'utf8')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw cause
  }
}

function xdgHome(configured: string | undefined, fallback: string) {
  return configured && isAbsolute(configured) ? configured : join(homedir(), fallback)
}

function declaresProtocol(content: string, scheme: string) {
  let mainGroup = false
  const fields = new Map<string, string>()
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('[')) {
      mainGroup = line === '[Desktop Entry]'
    } else if (mainGroup && !line.startsWith('#')) {
      const separator = line.indexOf('=')
      if (separator > 0) {
        fields.set(line.slice(0, separator).trimEnd(), line.slice(separator + 1).trimStart())
      }
    }
  }
  return (
    fields.get('Type') === 'Application' &&
    fields.get('Hidden') !== 'true' &&
    (fields
      .get('MimeType')
      ?.split(';')
      .includes('x-scheme-handler/' + scheme) ??
      false)
  )
}

function quoteExecArgument(value: string) {
  const literal = value.replaceAll('%', '%%')
  if (value.length && !/[\s"'\\><~|&;$*?#()`]/u.test(value)) {
    return literal
  }
  const quoted = literal.replace(/([\\"$`])/g, '\\$1')
  return '"' + quoted.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('\r', '\\r') + '"'
}

interface DesktopEntryOptions {
  name: string
  appId: string
  scheme: string
  executable: string
  args: readonly string[]
  profile?: string | undefined
}

export function linuxDesktopEntries({
  name,
  appId,
  scheme,
  executable,
  args,
  profile,
}: DesktopEntryOptions) {
  const desktopName = appId + '.desktop'
  const dataHome = xdgHome(process.env.XDG_DATA_HOME, '.local/share')
  const autostart = join(xdgHome(process.env.XDG_CONFIG_HOME, '.config'), 'autostart', desktopName)
  const desktopFile = join(dataHome, 'applications', desktopName)
  const launch = [executable, ...args].map(quoteExecArgument).join(' ')
  const owner =
    'X-Kisaki-Owner=' + appId + (profile !== undefined ? '/' + encodeURIComponent(profile) : '')
  const header = '[Desktop Entry]\nType=Application\nName=' + name + '\n' + owner + '\n'
  const loginContents = header + 'Exec=' + launch + ' --login\n'
  const launcherContents =
    header + 'Exec=' + launch + ' %U\nMimeType=x-scheme-handler/' + scheme + ';\n'

  function ownsEntry(contents: string | null) {
    return contents?.split(/\r?\n/).includes(owner) ?? false
  }

  async function writeEntry(path: string, contents: string, signal?: AbortSignal) {
    const old = await readRegistration(path)
    signal?.throwIfAborted()
    if (old === contents) {
      return
    }
    if (old === null) {
      await mkdir(dirname(path), { recursive: true })
      signal?.throwIfAborted()
      await writeFile(path, contents, { flag: 'wx' })
      return
    }
    if (!ownsEntry(old)) {
      throw new DesktopError('Conflict', 'This desktop entry belongs to another launcher')
    }

    const replacement = path + '.' + randomUUID()
    try {
      await writeFile(replacement, contents, { flag: 'wx' })
      signal?.throwIfAborted()
      await rename(replacement, path)
    } finally {
      await rm(replacement, { force: true })
    }
  }

  async function hasProtocolHandler() {
    const roots = [
      dataHome,
      ...(process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':').filter(isAbsolute),
    ]
    for (const root of roots) {
      const content = await readRegistration(join(root, 'applications', desktopName))
      if (content === null) {
        continue
      }
      return declaresProtocol(content, scheme)
    }
    return false
  }

  return {
    name: desktopName,
    hasProtocolHandler,
    async hasLoginItem() {
      return ownsEntry(await readRegistration(autostart))
    },
    async setLoginItem(enabled: boolean, signal?: AbortSignal) {
      if (enabled) {
        await writeEntry(autostart, loginContents, signal)
      } else if (ownsEntry(await readRegistration(autostart))) {
        signal?.throwIfAborted()
        await rm(autostart)
      }
    },
    async isRegistered() {
      return (await readRegistration(desktopFile)) === launcherContents
    },
    register: (signal?: AbortSignal) => writeEntry(desktopFile, launcherContents, signal),
  }
}
