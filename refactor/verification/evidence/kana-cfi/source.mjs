// Build format-owned XML facts without assigning display-node numbers.
import { fail } from './grammar.mjs'

export async function createSourceParser(factory, catalog) {
  let root
  let stack = []
  const module = await factory({
    catalogIds: new Set(catalog.publicIds),
    catalogBytes: new TextEncoder().encode(catalog.dtd),
    singleByteMaps: {},
    sourceEvent(kind, value, attributes) {
      if (kind === 'start') {
        const [namespace, local] = value.includes('\x1f') ? value.split('\x1f') : ['', value]
        const idIndex = module._kana_cfi_id_attribute()
        const node = {
          kind: 'element',
          name: local,
          namespace,
          attributes,
          declaredId: idIndex >= 0 ? attributes[idIndex / 2][1] : null,
          children: []
        }
        if (stack.length) stack.at(-1).children.push(node)
        else root = node
        stack.push(node)
      } else if (kind === 'end') stack.pop()
      else if (value && stack.length) {
        const children = stack.at(-1).children
        const last = children.at(-1)
        if (last?.kind === 'text') last.text += value
        else children.push({ kind: 'text', text: value })
      }
    }
  })
  return {
    parse(bytes, chunk = 4096) {
      root = null
      stack = []
      const encoding = module._malloc(6)
      module.HEAPU8.set(new TextEncoder().encode('UTF-8\0'), encoding)
      const buffer = module._malloc(chunk)
      try {
        if (
          !module._kana_entry_open(
            encoding,
            256,
            100000,
            8 * 1024 * 1024,
            1024 * 1024,
            8 * 1024 * 1024
          )
        )
          fail('resourceLimit')
        for (let offset = 0; offset < bytes.length; offset += chunk) {
          const part = bytes.subarray(offset, offset + chunk)
          module.HEAPU8.set(part, buffer)
          if (!module._kana_xml_feed(buffer, part.length, 0)) fail('invalidDocument')
        }
        if (!module._kana_xml_feed(buffer, 0, 1)) fail('invalidDocument')
        return root
      } finally {
        module._kana_xml_close()
        module._free(buffer)
        module._free(encoding)
        root = null
        stack = []
      }
    }
  }
}
