/**
 * @fileoverview Prepares isolated extraction locations for tests of
 * existing packaged applications.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import extractZip from 'extract-zip'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'

/** Extracted build artifact and inspection paths owned by one artifact test. */
export interface ArtifactWorkspace {
  directory: string
  executablePath: string
  resourceDirectory: string
  /** Binary or macOS application bundle accepted by Electron fuse inspection. */
  fusePath: string

  /** Removes the extraction after the caller has confirmed application exit. */
  close(): Promise<void>
}

/**
 * Extracts a supplied build artifact into an isolated test directory.
 *
 * Returns platform launch, resource and fuse-inspection paths. Extraction failure removes partial
 * output; after success the caller closes the workspace after its application exits.
 */
export async function prepareArtifactWorkspace(archivePath: string): Promise<ArtifactWorkspace> {
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-artifact-'))

  try {
    let executablePath: string
    let resourceDirectory: string
    let fusePath: string
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

    return {
      directory,
      executablePath,
      resourceDirectory,
      fusePath,
      /** Removes this test's extraction and profile tree after application shutdown. */
      close: () => rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
    }
  } catch (cause) {
    return rethrowAfterCleanup(
      cause,
      () => rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
      'Artifact extraction and cleanup failed',
    )
  }
}
