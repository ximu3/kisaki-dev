// Compare documented parser APIs against the same source-content expectations.
import { cases } from './cases.mjs'
import { sourceText } from './parser.mjs'

const XMLNS = 'http://www.w3.org/2000/xmlns/'
const sortAttributes = (items) => items.sort(([a], [b]) => (a === b ? 0 : a < b ? -1 : 1))
const addText = (children, text) => {
  if (!text) return
  if (typeof children.at(-1) === 'string') children[children.length - 1] += text
  else children.push(text)
}

export function domTree(element) {
  const children = []
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === 1) children.push(domTree(node))
    else if (node.nodeType === 3 || node.nodeType === 4) addText(children, node.nodeValue)
  }
  return {
    name: element.localName,
    namespace: element.namespaceURI ?? '',
    attributes: sortAttributes(
      Array.from(element.attributes)
        .filter((attribute) => attribute.namespaceURI !== XMLNS)
        .map((attribute) => [
          attribute.namespaceURI
            ? `${attribute.namespaceURI}\x1f${attribute.localName}`
            : attribute.name,
          attribute.value
        ])
    ),
    children
  }
}

function orderedTree(list, inherited = { xml: 'http://www.w3.org/XML/1998/namespace' }) {
  const output = []
  for (const item of list) {
    if ('#text' in item) {
      addText(output, item['#text'])
      continue
    }
    if ('#cdata' in item) {
      for (const part of item['#cdata']) if ('#text' in part) addText(output, part['#text'])
      continue
    }
    const name = Object.keys(item).find((key) => key !== ':@')
    if (!name || name.startsWith('?') || name.startsWith('!')) continue
    const attributes = Object.entries(item[':@'] ?? {})
    const namespaces = { ...inherited }
    for (const [key, value] of attributes) {
      if (key === 'xmlns') namespaces[''] = value
      else if (key.startsWith('xmlns:')) namespaces[key.slice(6)] = value
    }
    const parts = name.split(':')
    output.push({
      name: parts.at(-1),
      namespace: namespaces[parts.length === 2 ? parts[0] : ''] ?? '',
      attributes: sortAttributes(
        attributes
          .filter(([key]) => key !== 'xmlns' && !key.startsWith('xmlns:'))
          .map(([key, value]) => {
            const parts = key.split(':')
            return [
              parts.length === 2 && namespaces[parts[0]]
                ? `${namespaces[parts[0]]}\x1f${parts[1]}`
                : key,
              value
            ]
          })
      ),
      children: orderedTree(item[name], namespaces)
    })
  }
  return output
}

function observe(item, result) {
  let matches = item.reject ? !result.ok : result.ok && sourceText(result.tree) === item.text
  if (matches && !item.reject && item.attributes)
    matches = JSON.stringify(result.tree.attributes) === JSON.stringify(item.attributes)
  if (matches && !item.reject && item.namespace) matches = result.tree.namespace === item.namespace
  if (matches && !item.reject && item.childCount !== undefined)
    matches = result.tree.children.length === item.childCount
  if (matches && !item.reject && item.childElement)
    matches = result.tree.children.some(
      (child) => typeof child !== 'string' && child.name === item.childElement
    )
  return {
    name: item.name,
    ok: result.ok,
    matchesSourceContract: matches,
    ...(result.ok
      ? {
          text: sourceText(result.tree).slice(0, 96),
          rootAttributes: result.tree.attributes,
          directElementNames: result.tree.children
            .filter((child) => typeof child !== 'string')
            .map((child) => child.name)
        }
      : {
          errorName: result.errorName ?? null,
          failure: result.failure ?? null,
          nativeError: result.nativeError ?? null
        }),
    ...(result.catalogUses !== undefined
      ? { catalogUses: result.catalogUses, skippedSubsets: result.skippedSubsets }
      : {})
  }
}

export async function compare(modules, parser, namedEntities, NativeDOMParser) {
  const results = {}
  const allNamed = Object.fromEntries(
    Object.entries(namedEntities)
      .filter(([key]) => key.endsWith(';'))
      .map(([key, value]) => [key.slice(1, -1), value.characters])
  )
  const candidates = [
    'saxes',
    'xmldom',
    'fast-xml-parser-default',
    'fast-xml-parser-configured',
    'expat'
  ]
  if (NativeDOMParser) candidates.push('native-dom')
  for (const candidate of candidates) {
    const observations = []
    const chunks = candidate === 'saxes' || candidate === 'expat' ? [1, 17, 4096] : [null]
    for (const item of cases) {
      for (const chunk of chunks) {
        let result
        try {
          if (candidate === 'expat')
            result = parser.parse(new TextEncoder().encode(item.source), chunk)
          else if (candidate === 'saxes') {
            let root
            const stack = []
            const sax = new modules.SaxesParser({
              xmlns: true,
              defaultXMLVersion: '1.0',
              forceXMLVersion: true
            })
            if (item.catalog) Object.assign(sax.ENTITIES, allNamed)
            sax.on('error', (error) => {
              throw error
            })
            sax.on('opentag', (tag) => {
              const node = {
                name: tag.local,
                namespace: tag.uri,
                attributes: sortAttributes(
                  Object.values(tag.attributes)
                    .filter((attribute) => attribute.uri !== XMLNS)
                    .map((attribute) => [
                      attribute.uri ? `${attribute.uri}\x1f${attribute.local}` : attribute.name,
                      attribute.value
                    ])
                ),
                children: []
              }
              if (stack.length) stack.at(-1).children.push(node)
              else root = node
              stack.push(node)
            })
            sax.on('closetag', () => stack.pop())
            const text = (value) => {
              if (stack.length) addText(stack.at(-1).children, value)
            }
            sax.on('text', text)
            sax.on('cdata', text)
            for (let offset = 0; offset < item.source.length; offset += chunk)
              sax.write(item.source.slice(offset, offset + chunk))
            sax.close()
            result = { ok: true, tree: root }
          } else if (candidate === 'xmldom' || candidate === 'native-dom') {
            const constructor = candidate === 'xmldom' ? modules.DOMParser : NativeDOMParser
            const dom =
              candidate === 'xmldom'
                ? new constructor({
                    onError: () => {
                      throw new Error('XML diagnostic.')
                    }
                  })
                : new constructor()
            const doc = dom.parseFromString(item.source, item.mime ?? 'application/xml')
            // These controlled inputs contain no authored parsererror element.
            const parseError = doc.getElementsByTagName('parsererror').length > 0
            result = parseError
              ? { ok: false, errorName: 'NativeParserError' }
              : { ok: true, tree: domTree(doc.documentElement) }
          } else {
            const entityDecoder = candidate.endsWith('configured')
              ? new modules.EntityDecoder({
                  namedEntities: item.catalog ? allNamed : {},
                  numericAllowed: true,
                  ncr: { xmlVersion: 1.0, nullNCR: 'throw' },
                  onInputEntity: () => modules.ENTITY_ACTION.ALLOW,
                  limit: {
                    maxTotalExpansions: 10000,
                    maxExpandedLength: 100000,
                    applyLimitsTo: 'all'
                  }
                })
              : undefined
            const xml = new modules.XMLParser({
              preserveOrder: true,
              ignoreAttributes: false,
              attributeNamePrefix: '',
              trimValues: false,
              parseTagValue: false,
              parseAttributeValue: false,
              ignoreDeclaration: true,
              ignorePiTags: true,
              cdataPropName: '#cdata',
              processEntities: {
                enabled: true,
                maxTotalExpansions: 10000,
                maxExpandedLength: 100000
              },
              ...(entityDecoder ? { entityDecoder } : {})
            })
            const tree = orderedTree(xml.parse(item.source, true))[0]
            result = { ok: true, tree }
          }
        } catch (error) {
          result = { ok: false, errorName: error.name }
        }
        observations.push({ ...observe(item, result), chunk })
      }
    }
    results[candidate] = {
      comparisons: observations.length,
      matched: observations.filter((item) => item.matchesSourceContract).length,
      observations
    }
  }
  if (results.expat.matched !== results.expat.comparisons)
    throw new Error('The proposed XML parser did not satisfy the source expectations.')
  return results
}

export function checkCatalog(parser, namedEntities, NativeDOMParser) {
  const names = Object.entries(namedEntities).filter(([key]) => key.endsWith(';'))
  const source =
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "https://xml-input.invalid/xhtml.dtd">' +
    '<html xmlns="http://www.w3.org/1999/xhtml"><body>' +
    names.map(([name]) => `<e name="${name.slice(1, -1)}" a="${name}">${name}</e>`).join('') +
    '</body></html>'
  const parsed = parser.parse(new TextEncoder().encode(source), 31)
  if (!parsed.ok) throw new Error('The standard entity catalog did not parse.')
  const elements = parsed.tree.children[0].children
  const mismatches = []
  for (let i = 0; i < names.length; i++) {
    const [name, { characters }] = names[i]
    const node = elements[i]
    if (
      sourceText(node) !== characters ||
      node.attributes.find(([key]) => key === 'a')[1] !== characters.replace(/[\t\r\n]/g, ' ')
    )
      mismatches.push(name)
  }
  let browserMatched = null
  if (NativeDOMParser) {
    const native = new NativeDOMParser().parseFromString(source, 'application/xhtml+xml')
    browserMatched = JSON.stringify(domTree(native.documentElement)) === JSON.stringify(parsed.tree)
  }
  if (mismatches.length || browserMatched === false)
    throw new Error('The standard entity catalog differed from its independent expectation.')
  return { names: names.length, catalogUses: parsed.catalogUses, mismatches, browserMatched }
}
