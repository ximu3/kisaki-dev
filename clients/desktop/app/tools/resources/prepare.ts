import { createRequire } from 'node:module'
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { appRoot } from '../lib/paths'
import type { DesktopTarget } from '../lib/targets'
import { removeOutputs } from '@kisaki3/tooling/output'
import { copyFonts, type FontInput } from './fonts'
import { copyMediaRuntime } from './media'

const requireDependency = createRequire(join(appRoot, 'package.json'))

async function prepareIcons(icons: string): Promise<void> {
  await mkdir(icons, { recursive: true })
  const sourceIcon = join(appRoot, 'assets', 'icons', 'source.png')
  await sharp(sourceIcon).resize(512, 512).png().toFile(join(icons, 'icon.png'))

  const ico = await pngToIco(await sharp(sourceIcon).resize(256, 256).png().toBuffer())
  await writeFile(join(icons, 'icon.ico'), ico)
}

export async function prepareResources(
  target: DesktopTarget,
  signal?: AbortSignal,
  output = join(appRoot, 'out', 'resources', target),
): Promise<string> {
  const fontInputs = JSON.parse(
    await readFile(join(appRoot, 'assets', 'fonts', 'inputs.json'), 'utf8'),
  ) as FontInput[]

  await removeOutputs(appRoot, [output], signal)
  await mkdir(output, { recursive: true })

  await prepareIcons(join(output, 'icons'))
  await copyFonts(fontInputs, join(output, 'fonts'))
  await copyMediaRuntime(join(output, 'media'))
  await cp(join(appRoot, 'drizzle'), join(output, 'drizzle'), { recursive: true })
  await cp(join(appRoot, 'assets', 'licenses'), join(output, 'licenses'), { recursive: true })
  const dequalRoot = dirname(requireDependency.resolve('dequal/package.json'))
  await copyFile(join(dequalRoot, 'license'), join(output, 'licenses', 'dequal.txt'))

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
