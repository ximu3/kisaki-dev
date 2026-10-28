/**
 * @fileoverview Assembles fonts, icons and the target's SQLite binding into a complete
 * desktop resource set with file digests.
 */

import { createRequire } from 'node:module'
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { appRoot } from '../lib/paths'
import type { DesktopTarget } from '../../src/shared/runtime-manifest'
import { replaceOutput } from '@kisaki3/tooling/output'
import { sha256 } from '../lib/sha256'
import { copyFonts } from './fonts'
import type { FontInput } from './fonts'

const requireDependency = createRequire(join(appRoot, 'package.json'))

/** Write the PNG and ICO variants used by desktop packaging. */
async function prepareIcons(icons: string): Promise<void> {
  await mkdir(icons, { recursive: true })
  const sourceIcon = join(appRoot, 'assets', 'icons', 'source.png')
  await sharp(sourceIcon).resize(512, 512).png().toFile(join(icons, 'icon.png'))

  const ico = await pngToIco(await sharp(sourceIcon).resize(256, 256).png().toBuffer())
  await writeFile(join(icons, 'icon.ico'), ico)
}

/** Assemble the target resources and return their completed output directory. */
export async function prepareResources(
  target: DesktopTarget,
  signal?: AbortSignal,
): Promise<string> {
  const output = join(appRoot, 'out', 'resources', target)
  const fontInputs: FontInput[] = JSON.parse(
    await readFile(join(appRoot, 'assets', 'fonts', 'inputs.json'), 'utf8'),
  )

  await replaceOutput(
    appRoot,
    output,
    async (staging) => {
      await prepareIcons(join(staging, 'icons'))
      await copyFonts(fontInputs, join(staging, 'fonts'))

      // SQLite 13 provides Node-API prebuilds shared by the development and Electron runtimes.
      const sqliteRoot = dirname(requireDependency.resolve('better-sqlite3/package.json'))
      const platform = target.replace('windows', 'win32').replace('macos', 'darwin')
      const native = join(staging, 'native')
      await mkdir(native, { recursive: true })
      await copyFile(
        join(sqliteRoot, 'prebuilds', `${platform}.node`),
        join(native, 'better-sqlite3.node'),
      )

      const files: Record<string, string> = {}

      /** Add each prepared file's digest to the resource manifest. */
      async function record(directory: string, prefix: string): Promise<void> {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const relative = prefix ? `${prefix}/${entry.name}` : entry.name
          if (entry.isDirectory()) {
            await record(join(directory, entry.name), relative)
          } else {
            files[relative] = sha256(await readFile(join(directory, entry.name)))
          }
        }
      }

      await record(staging, '')
      await writeFile(join(staging, 'resources.json'), JSON.stringify({ target, files }, null, 2))
    },
    signal,
  )

  return output
}
