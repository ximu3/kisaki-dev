import { execFile, type ExecFileException } from 'node:child_process'
import { appendFile, mkdir, realpath, writeFile } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'

const execute = promisify(execFile)

interface DiskImage {
  'image-path': string
  'system-entities': { 'dev-entry': string; 'mount-point'?: string }[]
}

async function openFiles(mount: string): Promise<string> {
  try {
    const args = ['-nP', '-Fpc', '+f', '--', mount]
    const { stdout } =
      process.env.GITHUB_ACTIONS === 'true'
        ? await execute('/usr/bin/sudo', ['-n', '/usr/sbin/lsof', ...args], { timeout: 5_000 })
        : await execute('/usr/sbin/lsof', args, { timeout: 5_000 })
    return stdout.trim()
  } catch (cause) {
    const error = cause as ExecFileException
    if (error.code === 1 && !error.stdout?.trim() && !error.stderr?.trim()) {
      return 'No open files reported'
    }
    return 'Open-file lookup failed: ' + error.message
  }
}

async function mountSnapshot(output: string, devices: Set<string>): Promise<string> {
  const info = await execute('/usr/bin/hdiutil', ['info', '-plist'], { timeout: 5_000 })
  const convert = execute('/usr/bin/plutil', ['-extract', 'images', 'json', '-o', '-', '--', '-'], {
    timeout: 5_000,
  })
  const [json] = await Promise.all([
    convert,
    pipeline(Readable.from([info.stdout]), convert.child.stdin!),
  ])
  const images = JSON.parse(json.stdout) as DiskImage[]
  const mounts: string[] = []
  for (const image of images) {
    const path = image['image-path']
    if (!path.endsWith('.dmg') || dirname(path) !== output) {
      continue
    }
    for (const entity of image['system-entities']) {
      const mount = entity['mount-point']
      if (mount) {
        const device = entity['dev-entry']
        devices.add(basename(device))
        mounts.push(
          `${device} mounted at ${mount} from ${basename(path)}\n${await openFiles(mount)}`,
        )
      }
    }
  }
  return mounts.join('\n') || 'No mounted DMG from this output directory'
}

export function observeDmg(directory: string, report: string) {
  const stop = new AbortController()
  const devices = new Set<string>()
  const started = Date.now()

  async function sample() {
    const output = await realpath(directory)
    await mkdir(dirname(report), { recursive: true })
    await writeFile(report, '')
    let previous: string | undefined
    while (!stop.signal.aborted) {
      const snapshot = await mountSnapshot(output, devices).catch(
        (cause: unknown) => 'Mount observation failed: ' + String(cause),
      )
      if (previous !== snapshot) {
        await appendFile(report, `${new Date().toISOString()}\n${snapshot}\n`)
        previous = snapshot
      }
      await delay(1_000, undefined, { signal: stop.signal })
    }
  }

  const sampling = sample().catch((cause: unknown) => {
    if (!(stop.signal.aborted && cause instanceof Error && cause.name === 'AbortError')) {
      console.warn('DMG mount observation failed:', cause)
    }
  })
  return async (packaged: boolean) => {
    stop.abort()
    await sampling
    console.info(`Observed ${devices.size} DMG device(s). Report: ${report}`)
    if (!packaged && devices.size) {
      // dmgbuild can force-detach the disk before returning its original error.
      const disks = [...devices].map(
        (device) => 'eventMessage CONTAINS[c] ' + JSON.stringify(device),
      )
      const minutes = Math.max(1, Math.ceil((Date.now() - started) / 60_000))
      try {
        const { stdout } = await execute(
          '/usr/bin/log',
          [
            'show',
            '--style',
            'compact',
            '--info',
            '--debug',
            '--last',
            minutes + 'm',
            '--predicate',
            `process == "diskarbitrationd" AND (${disks.join(' OR ')})`,
          ],
          { timeout: 10_000 },
        )
        await appendFile(report, '\nDisk Arbitration events\n' + stdout)
      } catch (cause) {
        console.warn('Could not retain Disk Arbitration events:', cause)
      }
    }
  }
}
