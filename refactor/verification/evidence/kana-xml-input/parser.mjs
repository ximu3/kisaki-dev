// Build a bounded logical source observation from Expat events, independent of browser DOM.
export async function createParser(factory, catalog, singleByteMaps, onEvent) {
  let root = null
  let stack = []
  let emitTree = true
  let textUnits = 0
  const module = await factory({
    catalogIds: new Set(catalog.publicIds),
    catalogBytes: new TextEncoder().encode(catalog.dtd),
    singleByteMaps,
    sourceEvent(kind, value, attributes) {
      onEvent?.(kind)
      if (kind === 'text') textUnits += value.length
      if (!emitTree) return
      if (kind === 'start') {
        const parts = value.split('\x1f')
        const node = {
          name: parts.at(-1),
          namespace: parts.length === 2 ? parts[0] : '',
          attributes: attributes
            .map(([name, value]) => [name, value])
            .sort(([a], [b]) => (a === b ? 0 : a < b ? -1 : 1)),
          children: []
        }
        if (stack.length) stack.at(-1).children.push(node)
        else root = node
        stack.push(node)
      } else if (kind === 'end') stack.pop()
      else if (value && stack.length) {
        const children = stack.at(-1).children
        if (typeof children.at(-1) === 'string') children[children.length - 1] += value
        else children.push(value)
      }
    }
  })

  function parse(bytes, chunk = 17, limits = {}) {
    root = null
    stack = []
    textUnits = 0
    emitTree = limits.emitTree !== false
    if (
      !module._kana_xml_open(
        limits.depth ?? 128,
        limits.nodes ?? 100000,
        limits.text ?? 4 * 1024 * 1024,
        limits.metadata ?? 1024 * 1024,
        limits.amplificationThreshold ?? 8 * 1024 * 1024
      )
    )
      throw new Error('XML proof parser could not be created.')
    const memory = module._malloc(chunk)
    if (!memory) {
      module._kana_xml_close()
      throw new Error('XML proof input allocation failed.')
    }
    try {
      let status = 1
      for (let offset = 0; offset < bytes.length && status; offset += chunk) {
        const part = bytes.subarray(offset, offset + chunk)
        module.HEAPU8.set(part, memory)
        status = module._kana_xml_feed(memory, part.length, 0)
      }
      if (status) status = module._kana_xml_feed(memory, 0, 1)
      const observation = {
        ok: !!status,
        failure: module._kana_xml_failure(),
        nativeError: module._kana_xml_error(),
        catalogUses: module._kana_xml_catalog_uses(),
        skippedSubsets: module._kana_xml_skipped_subsets(),
        externalDeclarations: module._kana_xml_external_declarations()
      }
      return status
        ? { ...observation, tree: root, textUnits }
        : { ...observation, publishedTree: false }
    } finally {
      module._free(memory)
      module._kana_xml_close()
      root = null
      stack = []
    }
  }

  return {
    parse,
    get memoryBytes() {
      return module.HEAPU8.byteLength
    }
  }
}

export const sourceText = (node) =>
  typeof node === 'string' ? node : node.children.map(sourceText).join('')
