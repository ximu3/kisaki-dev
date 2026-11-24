import { spawn } from 'node:child_process'
import { join } from 'node:path'

export function observeDmg(output: string, report: string) {
  const observer = spawn(
    '/usr/bin/python3',
    [join(import.meta.dirname, 'observe.py'), output, report],
    {
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  )
  const closed = new Promise<void>((resolve) => {
    observer.on('error', (cause) => console.warn('Could not observe the DMG mount:', cause))
    observer.stdin.on('error', (cause) => console.warn('DMG observer input closed:', cause.message))
    observer.once('close', (code) => {
      if (code !== 0) {
        console.warn('DMG mount observer exited with status', code)
      }
      resolve()
    })
  })
  return async (packaged: boolean) => {
    observer.stdin.end(packaged ? 'complete' : 'failed')
    await closed
  }
}
