import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { rethrowAfterCleanup } from '@kisaki3/tooling/errors'

export interface ArtifactWorkspace {
  directory: string
  executablePath: string
  resourceDirectory: string
  fusePath: string

  close(): Promise<void>
}

export async function prepareArtifactWorkspace(
  archivePath: string,
  identity: { name: string; linuxPackageName: string },
): Promise<ArtifactWorkspace> {
  const directory = await mkdtemp(join(tmpdir(), 'kisaki-artifact-'))

  try {
    let executablePath: string
    let resourceDirectory: string
    let fusePath: string
    if (process.platform === 'win32') {
      // Git for Windows also supplies GNU tar. System32 owns the ZIP-capable Windows bsdtar.
      await promisify(execFile)(
        join(process.env.SystemRoot!, 'System32', 'tar.exe'),
        ['-xf', archivePath, '-C', directory],
        {
          windowsHide: true,
        },
      )

      executablePath = join(directory, identity.name + '.exe')
      resourceDirectory = join(directory, 'resources')
      fusePath = executablePath
    } else if (process.platform === 'darwin') {
      await promisify(execFile)('ditto', ['-x', '-k', archivePath, directory])

      const application = join(directory, identity.name + '.app')
      executablePath = join(application, 'Contents', 'MacOS', identity.name)
      resourceDirectory = join(application, 'Contents', 'Resources')
      fusePath = application
    } else {
      executablePath = join(directory, basename(archivePath))
      await copyFile(archivePath, executablePath)
      await promisify(execFile)('chmod', ['+x', executablePath])
      await promisify(execFile)(executablePath, ['--appimage-extract'], { cwd: directory })

      resourceDirectory = join(directory, 'squashfs-root', 'resources')
      fusePath = join(directory, 'squashfs-root', identity.linuxPackageName)
    }

    return {
      directory,
      executablePath,
      resourceDirectory,
      fusePath,
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
