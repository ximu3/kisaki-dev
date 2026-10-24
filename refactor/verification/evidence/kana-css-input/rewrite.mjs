// Preserve CSS structure while adapting resource references and selected source-attribute reads.
const reflectedNames = new Set(['src', 'href', 'srcset', 'style'])
export const namespaceTokens = new Map([
  ['', 'plain'],
  ['http://www.w3.org/1999/xlink', 'xlink']
])

export function reflectedName(namespace, localName) {
  const token = namespaceTokens.get(namespace)
  if (token === undefined) throw new Error('The controlled namespace was not registered.')
  return `data-kana-probe-${token}-${localName}`
}

function splitQualifiedName(raw) {
  for (let index = 0; index < raw.length; index++) {
    if (raw[index] !== '|') continue
    let escaped = 0
    for (let before = index - 1; before >= 0 && raw[before] === '\\'; before--) escaped++
    if (escaped % 2 === 0) return [raw.slice(0, index), raw.slice(index + 1)]
  }
  return [undefined, raw]
}

export function rewriteCss(
  css,
  source,
  { context = 'stylesheet', base, resolve, reflect = false }
) {
  const ast = css.parse(source, { context, parseCustomProperty: true })
  const namespaces = new Map()
  css.walk(ast, {
    visit: 'Atrule',
    enter(node) {
      if (node.name.toLowerCase() !== 'namespace') return
      const parts = node.prelude.children.toArray()
      const prefix = parts.length === 2 ? css.ident.decode(parts[0].name) : ''
      const value = parts.at(-1)
      if (value.type === 'Url' || value.type === 'String') namespaces.set(prefix, value.value)
    }
  })
  const attributeNames = (raw) => {
    const [prefix, local] = splitQualifiedName(raw)
    const name = css.ident.decode(local)
    if (!reflectedNames.has(name.toLowerCase())) return null
    const uris =
      prefix === undefined || prefix === ''
        ? ['']
        : prefix === '*'
          ? [...namespaceTokens.keys()]
          : [namespaces.get(css.ident.decode(prefix))]
    if (uris.some((uri) => uri === undefined)) return null
    return uris.map((uri) => reflectedName(uri, name))
  }
  let preludeDepth = 0
  const replacements = []
  const references = []
  const rewriteReference = (node, role) => {
    references.push({ role, source: node.value })
    node.value = resolve(node.value, base, role)
  }
  css.walk(ast, {
    enter(node) {
      if (node.type === 'AtrulePrelude') preludeDepth++
      if (node.type === 'Atrule' && node.name.toLowerCase() === 'import') {
        const first = node.prelude?.children.first
        if (first?.type === 'Url' || first?.type === 'String') rewriteReference(first, 'stylesheet')
      }
      if (node.type === 'Url' && preludeDepth === 0 && this.declaration) {
        if (this.declaration.property.startsWith('--'))
          references.push({ role: 'native-custom-property', source: node.value })
        else rewriteReference(node, 'declaration')
      }
      if (
        node.type === 'Function' &&
        ['image-set', '-webkit-image-set'].includes(node.name.toLowerCase()) &&
        preludeDepth === 0 &&
        this.declaration &&
        !this.declaration.property.startsWith('--')
      )
        for (const child of node.children)
          if (child.type === 'String') rewriteReference(child, 'image-set')
      if (!reflect) return
      if (
        node.type === 'AttributeSelector' &&
        !(preludeDepth && this.atrule?.name.toLowerCase() === 'supports')
      ) {
        const names = attributeNames(node.name.name)
        if (!names) return
        const selectors = names.map((name) =>
          css.generate({ ...node, name: { ...node.name, name: css.ident.encode(name) } })
        )
        const selector = selectors.length === 1 ? selectors[0] : `:is(${selectors.join(',')})`
        const replacement = css.parse(selector, { context: 'selector' }).children.first
        replacements.push(() => {
          for (const key of Object.keys(node)) delete node[key]
          Object.assign(node, replacement)
        })
      }
      if (node.type === 'Function' && node.name.toLowerCase() === 'attr') {
        const first = node.children.first
        if (first?.type !== 'Identifier') return
        const names = attributeNames(first.name)
        if (names?.length === 1) first.name = css.ident.encode(names[0])
      }
    },
    leave(node) {
      if (node.type === 'AtrulePrelude') preludeDepth--
    }
  })
  for (const replace of replacements) replace()
  return { css: css.generate(ast), references }
}
