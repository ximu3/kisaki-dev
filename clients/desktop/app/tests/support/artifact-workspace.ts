/**
 * @fileoverview Prepares isolated carrier and portable-profile locations for tests of
 * existing packaged applications.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import extractZip from 'extract-zip'

/** An extracted candidate and its isolated portable profile, owned by one artifact test. */
export interface ArtifactWorkspace {
  directory: string
  executablePath: string
  resourceDirectory: string
  fusePath: string
  dataDirectory: string
  close(): Promise<void>
}

/** Extract an existing candidate; close() removes it after its application process has exited. */
export async function prepareArtifactWorkspace(archivePath: string): Promise<ArtifactWorkspace> {
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-artifact-'))

  try {
    let executablePath: string
    let resourceDirectory: string
    let fusePath: string
    const dataDirectory = join(
      directory,
      process.platform === 'win32' ? 'data' : 'kisaki-portable-data',
    )

    if (process.platform === 'win32') {
      await extractZip(archivePath, { dir: directory })
      executablePath = join(directory, 'Kisaki.exe')
      resourceDirectory = join(directory, 'resources')
      fusePath = executablePath
    } else if (process.platform === 'darwin') {
      await promisify(execFile)('ditto', ['-x', '-k', archivePath, directory])
      const application = join(directory, 'Kisaki.app')
      executablePath = join(application, 'Contents', 'MacOS', 'Kisaki')
      resourceDirectory = join(application, 'Contents', 'Resources')
      fusePath = application
    } else {
      executablePath = join(directory, basename(archivePath))
      await copyFile(archivePath, executablePath)
      await promisify(execFile)('chmod', ['+x', executablePath])
      await promisify(execFile)(executablePath, ['--appimage-extract'], { cwd: directory })
      resourceDirectory = join(directory, 'squashfs-root', 'resources')
      fusePath = join(directory, 'squashfs-root', 'kisaki')
    }

    await mkdir(dataDirectory)
    await writeFile(join(directory, 'kisaki-portable.txt'), '')

    return {
      directory,
      executablePath,
      resourceDirectory,
      fusePath,
      dataDirectory,
      close: () => rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
    }
  } catch (cause) {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    throw cause
  }
}
