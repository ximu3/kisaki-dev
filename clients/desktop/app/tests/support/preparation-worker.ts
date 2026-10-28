/**
 * @fileoverview Models a pending dependency build so development startup cancellation can
 * be observed.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from '../../tools/lib/paths'

// A fixture package build reports readiness and stays pending so startup cancellation is observable.
const directory = join(repositoryRoot, '.cache')
await mkdir(directory, { recursive: true })
await writeFile(
  join(directory, 'dependency-preparation.json'),
  JSON.stringify({ pid: process.pid }),
)

setInterval(() => undefined, 1_000)
