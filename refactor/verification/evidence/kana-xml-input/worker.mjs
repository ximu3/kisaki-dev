// Keep the large cancellation exercise in a disposable worker with no browser DOM dependency.
import factory from '/expat/expat.mjs'
import * as modules from '/candidates.mjs'
import { createParser } from './parser.mjs'
import { compare, checkCatalog } from './compare.mjs'
import { boundaries, checkFb2 } from './boundaries.mjs'

self.onmessage = async ({ data }) => {
  try {
    const [catalog, maps, entities] = await Promise.all(
      ['catalog.json', 'encoding-maps.json', 'entities.json'].map(async (name) =>
        (await fetch('/' + name)).json()
      )
    )
    let entered = false
    const parser = await createParser(factory, catalog, maps, () => {
      if (data.mode === 'interrupt' && !entered) {
        entered = true
        self.postMessage({ type: 'enteredParser' })
      }
    })
    if (data.mode === 'interrupt') {
      const input = new TextEncoder().encode('<p>' + '<b>A</b>'.repeat(2_000_000) + '</p>')
      const result = parser.parse(input, 4096, {
        emitTree: false,
        nodes: 3_000_000,
        metadata: 8_000_000,
        text: 8_000_000
      })
      self.postMessage({ type: 'finishedLargeParse', ok: result.ok })
      return
    }
    const comparison = await compare(modules, parser, entities)
    const allCatalog = checkCatalog(parser, entities)
    const byteAndBudget = boundaries(parser)
    const fixture = await (await fetch('/fb2-fixtures.json')).json()
    const fb2 = await checkFb2(
      parser,
      fixture.cases,
      async (name) => new Uint8Array(await (await fetch('/fb2/' + name)).arrayBuffer())
    )
    self.postMessage({
      type: 'result',
      comparison,
      catalog: allCatalog,
      byteAndBudget,
      fb2,
      nativeDOMParserAvailable: typeof DOMParser !== 'undefined',
      nodeAvailable: typeof process !== 'undefined'
    })
  } catch (error) {
    self.postMessage({ type: 'error', errorName: error.name })
  }
}
