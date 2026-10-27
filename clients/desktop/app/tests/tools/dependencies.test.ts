import { expect, test } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { desktopDependencies } from '../../tools/dev/dependencies'

test('development snapshots include production workspace packages and exclude private engineering dependencies', async () => {
  const members = await desktopDependencies()
  const names = members.map((member) => member.name)

  expect(names).toContain('@kisaki3/appearance')
  expect(names).toContain('@kisaki3/ui')
  for (const member of members) {
    const manifest = JSON.parse(await readFile(join(member.path, 'package.json'), 'utf8'))
    expect(manifest.private, member.name).not.toBe(true)
    expect(manifest.exports, member.name).toBeDefined()
  }
})
