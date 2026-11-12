/**
 * @fileoverview Assembles fonts, icons and the target's SQLite binding into the target build workspace.
 */

import { createRequire } from 'node:module'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { appRoot } from '../lib/paths'
import type { DesktopTarget } from '../lib/runtime-manifest'
import { removeOutputs } from '@kisaki3/tooling/output'
import { copyFonts } from './fonts'
import type { FontInput } from './fonts'

const requireDependency = createRequire(join(appRoot, 'package.json'))

/** Writes packaging PNG and ICO variants from the project's source icon. */
async function prepareIcons(icons: string): Promise<void> {
  await mkdir(icons, { recursive: true })
  const sourceIcon = join(appRoot, 'assets', 'icons', 'source.png')
  await sharp(sourceIcon).resize(512, 512).png().toFile(join(icons, 'icon.png'))

  const ico = await pngToIco(await sharp(sourceIcon).resize(256, 256).png().toBuffer())
  await writeFile(join(icons, 'icon.ico'), ico)
}

/**
 * Prepares fonts, packaging icons and the selected SQLite binding in a clean output directory.
 *
 * The caller consumes the completed resources after this operation succeeds.
 */
export async function prepareResources(
  target: DesktopTarget,
  signal?: AbortSignal,
): Promise<string> {
  const output = join(appRoot, 'out', 'resources', target)
  const fontInputs = JSON.parse(
    await readFile(join(appRoot, 'assets', 'fonts', 'inputs.json'), 'utf8'),
  ) as FontInput[]

  await removeOutputs(appRoot, [output], signal)
  await mkdir(output, { recursive: true })

  await prepareIcons(join(output, 'icons'))
  await copyFonts(fontInputs, join(output, 'fonts'))

  // SQLite 13 provides Node-API prebuilds shared by the development and Electron runtimes.
  const sqliteRoot = dirname(requireDependency.resolve('better-sqlite3/package.json'))
  const platform = target.replace('windows', 'win32').replace('macos', 'darwin')
  const native = join(output, 'native')
  await mkdir(native, { recursive: true })
  await copyFile(
    join(sqliteRoot, 'prebuilds', `${platform}.node`),
    join(native, 'better-sqlite3.node'),
  )

  signal?.throwIfAborted()

  return output
}
