// Exercise the byte entry in an actual worker; codec glue and Wasm load only when requested.
import xmlFactory from './xml.mjs'
import { runEntryCases } from './cases.mjs'

globalThis.onmessage = async ({ data }) => {
  try {
    const [registry, catalog, dtd, fixtures] = await Promise.all([
      fetch(new URL('./registry.json', import.meta.url)).then((response) => response.json()),
      fetch(new URL('./catalog.json', import.meta.url)).then((response) => response.json()),
      fetch(new URL('./catalog.dtd', import.meta.url)).then((response) => response.text()),
      fetch(new URL('./fixtures.json', import.meta.url)).then((response) => response.json())
    ])
    catalog.dtd = dtd
    if (data === 'native')
      fixtures.cases = fixtures.cases.filter(
        (item) => item.route === 'native' || /^encoded-UTF-(8|16LE|16BE)$/.test(item.name)
      )
    const codecFactory = async (options) => {
      const { default: factory } = await import('./codec.mjs')
      return factory(options)
    }
    const result = await runEntryCases(xmlFactory, codecFactory, registry, catalog, fixtures, {
      fixturesOnly: data === 'native'
    })
    globalThis.postMessage({
      ok: true,
      ...result,
      hasDomParser: typeof DOMParser !== 'undefined',
      hasDocument: typeof document !== 'undefined'
    })
  } catch (error) {
    globalThis.postMessage({ ok: false, error: error.stack })
  }
}
