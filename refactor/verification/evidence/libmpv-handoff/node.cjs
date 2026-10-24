const fs = require('node:fs')
const { runScenario, nodeTransport } = require('./scenario.cjs')
const [addon, dll, red, blue, missing, output] = process.argv.slice(2)
const deadline = setTimeout(() => process.exit(2), 40000)
;(async () => {
  const cases = []
  for (const renderFirst of [false, true]) {
    cases.push(
      await runScenario({ addon, dll, red, blue, missing, renderFirst, transport: nodeTransport() })
    )
  }
  fs.writeFileSync(output, `${JSON.stringify({ node: process.versions.node, cases }, null, 2)}\n`)
  clearTimeout(deadline)
  console.log(JSON.stringify(cases.map(({ stats, staleNodeDrops }) => ({ stats, staleNodeDrops }))))
})().catch((error) => {
  console.error(error)
  clearTimeout(deadline)
  process.exitCode = 1
})
