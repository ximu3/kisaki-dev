// Record the ordering mechanism separately from image recognition and source extraction.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import { checkOrder } from './cases.mjs'
const here = path.dirname(fileURLToPath(import.meta.url))
const cache = path.resolve(here, '../../../../node_modules/.cache/kana-image-order')
const bytes = await fs.readFile(path.join(cache, 'unicode.json'))
const receipt = JSON.parse(await fs.readFile(path.join(here, 'source-input.json'), 'utf8'))
if (crypto.createHash('sha256').update(bytes).digest('hex') !== receipt.dataSha256)
  throw new Error('The pinned ordering data changed.')
const result = checkOrder(JSON.parse(bytes))
const sourceHashes = {}
for (const name of ['order.mjs', 'cases.mjs', 'run-node.mjs', 'prepare.py', 'source-input.json'])
  sourceHashes[name] = crypto
    .createHash('sha256')
    .update(await fs.readFile(path.join(here, name)))
    .digest('hex')
await fs.writeFile(
  path.join(here, 'node-contract.json'),
  JSON.stringify(
    { checkedAt: new Date().toISOString(), node: process.version, ...result, sourceHashes },
    null,
    2
  ) + '\n'
)
console.log(JSON.stringify(result))
