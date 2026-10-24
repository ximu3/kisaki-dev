// Keep source addresses at lexical emission and follow the parser's actual tree mutations.
export class SourceFailure extends Error {
  constructor(reason) {
    super('The source address cannot be resolved.')
    this.reason = reason
  }
}
const requireFact = (condition, message) => {
  if (!condition) throw new Error(message)
}
const fail = (reason) => {
  throw new SourceFailure(reason)
}
const priorEmissionStates = new Set([
  '_stateTagOpen',
  '_stateEndTagOpen',
  '_stateRcdataLessThanSign',
  '_stateRcdataEndTagOpen',
  '_stateRcdataEndTagName',
  '_stateRawtextLessThanSign',
  '_stateRawtextEndTagOpen',
  '_stateRawtextEndTagName',
  '_stateScriptDataLessThanSign',
  '_stateScriptDataEndTagOpen',
  '_stateScriptDataEndTagName',
  '_stateScriptDataEscapedLessThanSign',
  '_stateScriptDataEscapedEndTagOpen',
  '_stateScriptDataEscapedEndTagName',
  '_stateCdataSectionBracket',
  '_stateCdataSectionEnd'
])
const validBoundary = (text, offset) =>
  Number.isSafeInteger(offset) &&
  offset >= 0 &&
  offset <= text.length &&
  !(
    text.charCodeAt(offset - 1) >= 0xd800 &&
    text.charCodeAt(offset - 1) <= 0xdbff &&
    text.charCodeAt(offset) >= 0xdc00 &&
    text.charCodeAt(offset) <= 0xdfff
  )

export function createMarkupMapper({ Parser, Tokenizer, defaultTreeAdapter }, singleByteMaps) {
  return function parse(bytes, encoding = 'utf-8', chunkSize = 4096) {
    requireFact(['utf-8', 'windows-1252'].includes(encoding), 'Unexpected MOBI source encoding.')
    const source =
      encoding === 'utf-8'
        ? new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
        : Array.from(bytes, (byte) => String.fromCodePoint(singleByteMaps[encoding][byte])).join('')
    const boundaries = new Map()
    let byte = 0
    let position = 0
    for (const value of source) {
      boundaries.set(position, byte)
      position += value.length
      byte += encoding === 'utf-8' ? new TextEncoder().encode(value).length : 1
    }
    boundaries.set(position, byte)
    requireFact(byte === bytes.length, 'The source byte map is incomplete.')
    const insertions = []
    const lexical = []
    const tags = []
    const attributeOrigins = new WeakMap()
    const elementOrigins = new WeakMap()
    const createdElements = []
    let active = null

    class SourceTokenizer extends Tokenizer {
      _startCharacterReference() {
        this.referenceStart = this.preprocessor.offset
        super._startCharacterReference()
      }
      _flushCodePointConsumedAsCharacterReference(cp) {
        this.reference =
          this.sourceState?.name === '_stateAmbiguousAmpersand'
            ? null
            : {
                sourceStart: this.referenceStart,
                sourceEnd: this.preprocessor.offset + 1
              }
        try {
          super._flushCodePointConsumedAsCharacterReference(cp)
        } finally {
          this.reference = null
        }
      }
      _emitCodePoint(cp) {
        const value = String.fromCodePoint(cp)
        const sourceEnd = this.preprocessor.offset + 1
        const sourceStart = sourceEnd - value.length
        const crlf = value === '\n' && source[sourceStart] === '\r' && source[sourceEnd] === '\n'
        this.emission = this.reference ?? {
          sourceStart,
          sourceEnd,
          ...(crlf ? { omittedLf: sourceEnd } : {})
        }
        if (!this.reference)
          requireFact(
            source.slice(sourceStart, sourceEnd).replace(/\r/g, '\n') === value,
            'A lexical code point lost its source interval.'
          )
        try {
          super._emitCodePoint(cp)
        } finally {
          this.emission = null
        }
      }
      _emitChars(value) {
        const { name, cp } = this.sourceState
        let end = this.preprocessor.offset + 1
        if (priorEmissionStates.has(name)) {
          end = this.preprocessor.offset - (cp > 0xffff ? 1 : 0)
          if (name === '_stateScriptDataLessThanSign' && cp === 33) end++
          if (name === '_stateCdataSectionEnd' && cp === 93) end--
        }
        let start = end - value.length
        requireFact(
          source.slice(start, end) === value || (value === '\ufffd' && source[start] === '\0'),
          'Explicit lexical replay lost its source interval.'
        )
        for (const character of value) {
          this.emission = { sourceStart: start, sourceEnd: start + character.length }
          super._emitChars(character)
          start += character.length
        }
        this.emission = null
      }
      _appendCharToCurrentCharacterToken(type, value) {
        const origin = this.emission
        requireFact(origin, 'A character was emitted without a source interval.')
        super._appendCharToCurrentCharacterToken(type, value)
        const tokenUnits = (this.currentCharacterToken.sourceUnits ??= [])
        const last = tokenUnits.at(-1)
        if (last?.sourceStart === origin.sourceStart && last.sourceEnd === origin.sourceEnd) {
          last.value += value
        } else {
          const item = { ...origin, value }
          tokenUnits.push(item)
          lexical.push(item)
        }
        if (origin.omittedLf !== undefined) {
          const item = { sourceStart: origin.omittedLf, sourceEnd: origin.omittedLf + 1, value: '' }
          tokenUnits.push(item)
          lexical.push(item)
        }
      }
      emitCurrentTagToken() {
        const token = this.currentToken
        if (token.type === 3) {
          const item = {
            sourceStart: token.location.startOffset,
            tagName: token.tagName,
            nodes: []
          }
          attributeOrigins.set(token.attrs, item)
          tags.push(item)
        }
        super.emitCurrentTagToken()
      }
    }
    // State entry identifies literal replay; it does not reimplement HTML tokenization.
    for (const name of Object.getOwnPropertyNames(Tokenizer.prototype)) {
      if (!name.startsWith('_state')) continue
      const original = Tokenizer.prototype[name]
      SourceTokenizer.prototype[name] = function (cp) {
        const previous = this.sourceState
        this.sourceState = { name, cp }
        try {
          return original.call(this, cp)
        } finally {
          this.sourceState = previous
        }
      }
    }
    const adapter = {
      ...defaultTreeAdapter,
      createElement(tagName, namespace, attrs) {
        const node = defaultTreeAdapter.createElement(tagName, namespace, attrs)
        const origin = attributeOrigins.get(attrs)
        if (origin) {
          origin.nodes.push(node)
          elementOrigins.set(node, [origin])
        }
        createdElements.push(node)
        return node
      },
      adoptAttributes(node, attrs) {
        const origin = attributeOrigins.get(attrs)
        if (origin) {
          origin.nodes.push(node)
          elementOrigins.set(node, [...(elementOrigins.get(node) ?? []), origin])
        }
        defaultTreeAdapter.adoptAttributes(node, attrs)
      },
      insertText(parent, text) {
        const previous = parent.childNodes.at(-1)
        const offset = previous?.nodeName === '#text' ? previous.value.length : 0
        defaultTreeAdapter.insertText(parent, text)
        insertions.push({ node: parent.childNodes.at(-1), offset, text, token: active })
      },
      insertTextBefore(parent, text, reference) {
        const previous = parent.childNodes[parent.childNodes.indexOf(reference) - 1]
        const offset = previous?.nodeName === '#text' ? previous.value.length : 0
        defaultTreeAdapter.insertTextBefore(parent, text, reference)
        insertions.push({
          node: parent.childNodes[parent.childNodes.indexOf(reference) - 1],
          offset,
          text,
          token: active
        })
      }
    }
    class SourceParser extends Parser {
      constructor(options) {
        super(options)
        this.tokenizer = new SourceTokenizer(this.options, this)
      }
      _insertCharacters(token) {
        const value = token.sourceUnits?.map((unit) => unit.value).join('')
        if (value !== token.chars && value?.includes('\0')) {
          requireFact(
            value.replace(/\0/g, '\ufffd') === token.chars,
            'A foreign-content character transformation is not accounted for.'
          )
          for (const unit of token.sourceUnits) unit.value = unit.value.replace(/\0/g, '\ufffd')
        }
        active = { chars: token.chars, units: token.sourceUnits }
        try {
          super._insertCharacters(token)
        } finally {
          active = null
        }
      }
    }
    const parser = new SourceParser({
      sourceCodeLocationInfo: true,
      treeAdapter: adapter,
      scriptingEnabled: false
    })
    for (let offset = 0; offset < source.length; offset += chunkSize)
      parser.tokenizer.write(source.slice(offset, offset + chunkSize), false)
    parser.tokenizer.write('', true)
    const retained = new Set()
    function visit(node) {
      retained.add(node)
      node.childNodes?.forEach(visit)
      if (node.content) visit(node.content)
    }
    visit(parser.document)
    const projections = new Map()
    for (const insertion of insertions) {
      let items = insertion.token?.units
      requireFact(items, 'Inserted text has no lexical provenance.')
      let text = items.map((unit) => unit.value).join('')
      if (items[0]?.value === '\n' && text.slice(1) === insertion.text) {
        items = items.slice(1)
        text = items.map((unit) => unit.value).join('')
      }
      requireFact(text === insertion.text, 'Tree insertion changed lexical text unexpectedly.')
      let offset = insertion.offset
      for (const unit of items) {
        requireFact(
          insertion.node.value.slice(offset, offset + unit.value.length) === unit.value,
          'A repaired text node lost its lexical interval.'
        )
        if (retained.has(insertion.node)) {
          const list = projections.get(unit) ?? []
          list.push({ node: insertion.node, offset })
          projections.set(unit, list)
        }
        offset += unit.value.length
      }
    }
    const units = lexical.sort((a, b) => a.sourceStart - b.sourceStart)
    const byByte = new Map()
    let ordinal = 0
    for (const [index, unit] of units.entries()) {
      unit.byteStart = boundaries.get(unit.sourceStart)
      unit.byteEnd = boundaries.get(unit.sourceEnd)
      unit.ordinal = ordinal
      unit.projections = projections.get(unit) ?? []
      requireFact(
        unit.byteStart !== undefined && unit.byteEnd !== undefined,
        'An origin splits an encoded character.'
      )
      requireFact(!byByte.has(unit.byteStart), 'A lexical source interval was emitted twice.')
      byByte.set(unit.byteStart, index)
      ordinal += unit.value.length
    }
    const byTagByte = new Map()
    for (const tag of tags) {
      tag.byteStart = boundaries.get(tag.sourceStart)
      tag.nodes = tag.nodes.filter((node) => retained.has(node))
      byTagByte.set(tag.byteStart, tag)
    }
    function resolve(byteOffset, textOffset) {
      if (textOffset === undefined) {
        const tag = byTagByte.get(byteOffset)
        if (!tag) fail('invalidBoundary')
        if (!tag.nodes.length) fail('locationUnavailable')
        return { kind: 'element', nodes: tag.nodes }
      }
      let index = byByte.get(byteOffset)
      if (index === undefined || !Number.isSafeInteger(textOffset) || textOffset < 0)
        fail('invalidBoundary')
      let remaining = textOffset
      while (index < units.length) {
        const unit = units[index]
        if (remaining <= unit.value.length) {
          if (!validBoundary(unit.value, remaining)) fail('invalidBoundary')
          if (!unit.projections.length) fail('locationUnavailable')
          return {
            kind: 'text',
            ordinal: unit.ordinal + remaining,
            projections: unit.projections.map(({ node, offset }) => ({
              node,
              offset: offset + remaining
            }))
          }
        }
        remaining -= unit.value.length
        if (units[index + 1]?.sourceStart !== unit.sourceEnd) fail('invalidBoundary')
        index++
      }
      fail('invalidBoundary')
    }
    function fromText(node, offset, bias = 'after') {
      if (!validBoundary(node.value, offset)) fail('invalidBoundary')
      const candidates = []
      for (const unit of units) {
        for (const projection of unit.projections) {
          const relative = offset - projection.offset
          if (projection.node === node && validBoundary(unit.value, relative))
            candidates.push({ byteOffset: unit.byteStart, textOffset: relative, unit })
        }
      }
      if (!candidates.length) fail('locationUnavailable')
      const inner = candidates.find(
        (item) => item.textOffset > 0 && item.textOffset < item.unit.value.length
      )
      const selected =
        inner ??
        (bias === 'after'
          ? (candidates.find((item) => item.textOffset === 0) ?? candidates.at(-1))
          : (candidates.findLast((item) => item.textOffset === item.unit.value.length) ??
            candidates[0]))
      return { byteOffset: selected.byteOffset, textOffset: selected.textOffset }
    }
    return {
      tree: parser.document,
      source,
      units,
      tags,
      resolve,
      fromText,
      elementOrigins,
      createdElements
    }
  }
}
