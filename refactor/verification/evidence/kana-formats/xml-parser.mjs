// Preserve namespace-aware XML events as logical source nodes; no browser HTML parser is involved.
export async function createXmlParser(factory, singleByteMaps = {}) {
  let root = null
  let stack = []
  const module = await factory({
    singleByteMaps,
    sourceEvent(kind, value, attributes) {
      if (kind === 'start') {
        const [namespace, name] = value.includes('\x1f') ? value.split('\x1f') : [null, value]
        const element = { kind: 'element', name, namespace, attributes, children: [] }
        if (stack.length) stack.at(-1).children.push(element)
        else root = element
        stack.push(element)
      } else if (kind === 'end') stack.pop()
      else if (value && stack.length) {
        const children = stack.at(-1).children
        if (children.at(-1)?.kind === 'text') children.at(-1).text += value
        else children.push({ kind: 'text', text: value })
      }
    }
  })
  function parse(bytes, chunk = 7, limits = {}) {
    root = null
    stack = []
    if (
      !module._kana_xml_open(
        limits.depth ?? 128,
        limits.nodes ?? 100000,
        limits.output ?? 1024 * 1024,
        limits.amplificationThreshold ?? 8 * 1024 * 1024
      )
    )
      throw new Error('XML parser creation failed')
    const memory = module._malloc(chunk)
    if (!memory) {
      module._kana_xml_close()
      throw new Error('XML input allocation failed')
    }
    let status = 1,
      error,
      failure,
      skippedSubsets
    try {
      for (let position = 0; position < bytes.length && status; position += chunk) {
        const data = bytes.subarray(position, position + chunk)
        module.HEAPU8.set(data, memory)
        status = module._kana_xml_feed(memory, data.length, 0)
      }
      if (status) status = module._kana_xml_feed(memory, 0, 1)
      failure = module._kana_xml_failure()
      error = module._kana_xml_error()
      skippedSubsets = module._kana_xml_skipped_subsets()
      return status
        ? { ok: true, tree: root, skippedSubsets }
        : { ok: false, failure, nativeError: error, publishedTree: false }
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

export function withoutAttributes(tree) {
  if (tree.kind === 'text') return tree
  const { attributes, children, ...node } = tree
  return { ...node, children: children.map(withoutAttributes) }
}
export function sourceText(tree) {
  return tree.kind === 'text' ? tree.text : tree.children.map(sourceText).join('')
}
