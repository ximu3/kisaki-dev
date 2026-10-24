// Keep partial encoded characters in a bounded input tail and stream UTF-8 to the XML owner.
export class CodecFailure extends Error {
  constructor(reason) {
    super('The declared XML encoding cannot be decoded.')
    this.reason = reason
  }
}

export function createConverter(module) {
  const fail = (reason) => {
    throw new CodecFailure(reason)
  }
  return async function convert(parts, encoding, consume, options = {}) {
    const outputCapacity = options.outputCapacity ?? 4096
    const inputCapacity = options.inputCapacity ?? 8192
    const maxOutput = options.maxOutput ?? 2 * 1024 * 1024
    const name = new TextEncoder().encode(encoding + '\0')
    const namePointer = module._malloc(name.length)
    module.HEAPU8.set(name, namePointer)
    const handle = module._kana_codec_open(namePointer)
    module._free(namePointer)
    if (!handle) fail('unsupportedEncoding')
    const inputPointer = module._malloc(inputCapacity)
    const outputPointer = module._malloc(outputCapacity)
    let pending = new Uint8Array(0)
    let produced = 0
    let peakInput = 0
    let outputChunks = 0
    try {
      if (!inputPointer || !outputPointer) fail('resourceLimit')
      const publish = async () => {
        const count = module._kana_codec_produced()
        if (produced + count > maxOutput) fail('resourceLimit')
        produced += count
        if (count) {
          outputChunks++
          await consume(module.HEAPU8.slice(outputPointer, outputPointer + count))
        }
      }
      for await (const part of parts) {
        if (options.signal?.aborted) fail('cancelled')
        const bytes = new Uint8Array(pending.length + part.length)
        bytes.set(pending)
        bytes.set(part, pending.length)
        if (bytes.length > inputCapacity) fail('resourceLimit')
        peakInput = Math.max(peakInput, bytes.length)
        module.HEAPU8.set(bytes, inputPointer)
        let offset = 0
        pending = new Uint8Array(0)
        while (offset < bytes.length) {
          if (options.signal?.aborted) fail('cancelled')
          const status = module._kana_codec_convert(
            handle,
            inputPointer + offset,
            bytes.length - offset,
            outputPointer,
            outputCapacity
          )
          const consumed = module._kana_codec_consumed()
          offset += consumed
          await publish()
          if (status === -1) fail('invalidEncoding')
          if (status === 2) {
            pending = bytes.slice(offset)
            break
          }
          if (!consumed && !module._kana_codec_produced()) fail('resourceLimit')
        }
      }
      if (options.signal?.aborted) fail('cancelled')
      if (pending.length) fail('invalidEncoding')
      if (module._kana_codec_convert(handle, 0, 0, outputPointer, outputCapacity) !== 1)
        fail('invalidEncoding')
      await publish()
      return { bytes: produced, peakInput, outputCapacity, outputChunks }
    } finally {
      if (inputPointer) module._free(inputPointer)
      if (outputPointer) module._free(outputPointer)
      module._kana_codec_close(handle)
    }
  }
}
