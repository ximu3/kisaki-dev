/** @fileoverview Prints the Node and host facts recorded with repository and desktop verification. */

import { availableParallelism, cpus, totalmem } from 'node:os'

console.info(
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      parallelism: availableParallelism(),
      cpus: cpus().map((cpu) => cpu.model),
      memoryBytes: totalmem(),
    },
    null,
    2,
  ),
)
