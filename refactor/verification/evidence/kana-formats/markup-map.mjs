// Couple fixed HTML insertion events to byte provenance before repaired tree order diverges.
export function createMarkupMapper({ Parser, Tokenizer, defaultTreeAdapter }, encodingMaps) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  function decodeWithBoundaries(bytes, encoding) {
    const text =
      encoding === 'windows-1252'
        ? Array.from(bytes, (byte) => {
            const point = encodingMaps['windows-1252'][byte]
            assert(point >= 0, 'The fixed single-byte table cannot decode this value')
            return String.fromCodePoint(point)
          }).join('')
        : new TextDecoder(encoding, { fatal: true, ignoreBOM: true }).decode(bytes)
    const boundaries = new Array(text.length + 1).fill(null)
    let byte = 0,
      offset = 0
    for (const value of text) {
      boundaries[offset] = byte
      byte += encoding === 'utf-8' ? new TextEncoder().encode(value).length : 1
      offset += value.length
    }
    boundaries[offset] = byte
    assert(byte === bytes.length, 'Byte map does not cover the source encoding')
    return { text, boundaries }
  }
  return function parse(bytes, encoding, chunkSize) {
    assert(
      ['utf-8', 'windows-1252'].includes(encoding),
      'The probe requires a verified MOBI encoding'
    )
    const decoded = decodeWithBoundaries(bytes, encoding)
    const source = decoded.text
    const insertions = []
    let active
    class SourceTokenizer extends Tokenizer {
      _startCharacterReference() {
        this.sourceReferenceStart = this.preprocessor.offset
        super._startCharacterReference()
      }
      _flushCodePointConsumedAsCharacterReference(cp) {
        this.sourceReference = {
          sourceStart: this.sourceReferenceStart,
          sourceEnd: this.preprocessor.offset + 1
        }
        super._flushCodePointConsumedAsCharacterReference(cp)
        this.sourceReference = null
      }
      _emitCodePoint(cp) {
        const value = String.fromCodePoint(cp)
        let sourceEnd = this.preprocessor.offset + 1
        const sourceStart = sourceEnd - value.length
        const crlf = value === '\n' && source[sourceStart] === '\r' && source[sourceEnd] === '\n'
        if (crlf) sourceEnd++
        this.sourceEmission = this.sourceReference ?? {
          sourceStart,
          sourceEnd: crlf ? sourceEnd - 1 : sourceEnd,
          ...(crlf ? { omittedLf: sourceEnd - 1 } : {})
        }
        if (!this.sourceReference)
          assert(
            source.slice(sourceStart, sourceEnd).replace(/\r\n?/g, '\n') === value,
            'Tokenizer character origin differs'
          )
        super._emitCodePoint(cp)
        this.sourceEmission = null
      }
      _emitChars(value) {
        const sourceEnd = this.preprocessor.offset + 1,
          sourceStart = sourceEnd - value.length
        assert(
          source.slice(sourceStart, sourceEnd) === value ||
            (value === '\ufffd' && source[sourceStart] === '\0'),
          'Explicit tokenizer emission needs a source seam'
        )
        this.sourceEmission = { sourceStart, sourceEnd }
        super._emitChars(value)
        this.sourceEmission = null
      }
      _appendCharToCurrentCharacterToken(type, value) {
        const origin = this.sourceEmission
        assert(origin, 'Tokenizer emission has no source origin')
        super._appendCharToCurrentCharacterToken(type, value)
        const items = (this.currentCharacterToken.sourceUnits ??= [])
        const last = items.at(-1)
        if (last?.sourceStart === origin.sourceStart && last.sourceEnd === origin.sourceEnd)
          last.value += value
        else items.push({ ...origin, value })
        if (origin.omittedLf !== undefined)
          items.push({ sourceStart: origin.omittedLf, sourceEnd: origin.omittedLf + 1, value: '' })
      }
    }
    const adapter = {
      ...defaultTreeAdapter,
      insertText(parent, text) {
        const previous = parent.childNodes.at(-1)
        const start = previous?.nodeName === '#text' ? previous.value.length : 0
        defaultTreeAdapter.insertText(parent, text)
        insertions.push({ node: parent.childNodes.at(-1), start, text, token: active })
      },
      insertTextBefore(parent, text, reference) {
        const previous = parent.childNodes[parent.childNodes.indexOf(reference) - 1]
        const start = previous?.nodeName === '#text' ? previous.value.length : 0
        defaultTreeAdapter.insertTextBefore(parent, text, reference)
        insertions.push({
          node: parent.childNodes[parent.childNodes.indexOf(reference) - 1],
          start,
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
        active = { chars: token.chars, sourceUnits: token.sourceUnits }
        super._insertCharacters(token)
        active = null
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
    const units = []
    for (const insertion of insertions) {
      let mapped = insertion.token?.sourceUnits
      assert(mapped, 'Inserted text lacks lexical provenance')
      let value = mapped.map((unit) => unit.value).join('')
      if (mapped[0]?.value === '\n' && value.slice(1) === insertion.text) {
        mapped = mapped.slice(1)
        value = value.slice(1)
      }
      assert(value === insertion.text, 'HTML insertion changed lexical provenance')
      let nodeOffset = insertion.start
      for (const item of mapped) {
        assert(
          insertion.node.value.slice(nodeOffset, nodeOffset + item.value.length) === item.value,
          'Repaired node changed inserted text'
        )
        units.push({
          ...item,
          byteStart: decoded.boundaries[item.sourceStart],
          byteEnd: decoded.boundaries[item.sourceEnd],
          node: insertion.node,
          nodeOffset
        })
        nodeOffset += item.value.length
      }
    }
    units.sort((left, right) => left.sourceStart - right.sourceStart)
    const byByte = new Map()
    for (let index = 0; index < units.length; index++) {
      assert(!byByte.has(units[index].byteStart), 'A source unit was projected twice')
      byByte.set(units[index].byteStart, index)
    }
    const fail = () => {
      throw Object.assign(new Error('The byte address has no exact source text boundary.'), {
        reason: 'invalidBoundary'
      })
    }
    function resolve(byteOffset, textOffset = 0) {
      let index = byByte.get(byteOffset)
      if (index === undefined || !Number.isSafeInteger(textOffset) || textOffset < 0) fail()
      let remaining = textOffset
      while (index < units.length) {
        const unit = units[index]
        if (remaining <= unit.value.length) {
          const before = unit.value.charCodeAt(remaining - 1),
            after = unit.value.charCodeAt(remaining)
          if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff) fail()
          return { node: unit.node, offset: unit.nodeOffset + remaining }
        }
        remaining -= unit.value.length
        if (units[index + 1]?.sourceStart !== unit.sourceEnd) fail()
        index++
      }
      fail()
    }
    return { tree: parser.document, units, resolve, insertionCount: insertions.length }
  }
}
