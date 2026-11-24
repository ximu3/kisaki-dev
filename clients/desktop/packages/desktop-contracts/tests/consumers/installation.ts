import { readFile, writeFile } from 'node:fs/promises'
import { test } from 'vite-plus/test'
import { join, resolve } from 'node:path'
import { createConsumerTest } from '@kisaki3/tooling/testing/consumer'

const packageRoot = resolve(import.meta.dirname, '../..')

export function consumerTest(host: 'node' | 'browser') {
  return createConsumerTest(test, packageRoot, host, async (consumerDirectory) => {
    const installed = JSON.parse(
      await readFile(
        join(consumerDirectory, 'node_modules/@kisaki3/desktop-contracts/package.json'),
        'utf8',
      ),
    ) as { name: string; exports: Record<string, unknown> }
    const imports = Object.keys(installed.exports).map(
      (subpath) => `import '${installed.name}${subpath.slice(1)}'`,
    )
    await writeFile(join(consumerDirectory, 'public-entries.d.ts'), imports.join('\n'))
  })
}
