import { parentPort } from 'node:worker_threads'
import { inspectTextPattern } from '@kisaki3/desktop-contracts/text-rules'
import {
  parseFileRecognitionDefinitionShape,
  type FileWorkType,
} from '@kisaki3/desktop-contracts/library'
import { compileOutput, type NumberConversion } from './output'

type Message =
  | { type: 'compile'; medium: FileWorkType; definition: unknown }
  | { type: 'test'; baseName: string; path?: string }
function compile(medium: FileWorkType, input: unknown) {
  const definition = parseFileRecognitionDefinitionShape(medium, input)
  return definition.rules.map((rule) => {
    const { source, flags, captureNames } = inspectTextPattern(rule.pattern, rule.ignoreCase)
    return {
      id: rule.id,
      enabled: rule.enabled,
      input: rule.input,
      match: new RegExp(source + '(?![\\s\\S])', flags),
      output: rule.output.targets.map((target) => compileOutput(target, captureNames)),
    }
  })
}
const port = parentPort!
let rules: ReturnType<typeof compile> = []
port.on('message', (message: Message) => {
  let ruleId: string | null = null
  try {
    if (message.type === 'compile') {
      rules = compile(message.medium, message.definition)
      port.postMessage({ ok: true, value: null })
      return
    }
    for (const rule of rules) {
      if (!rule.enabled) {
        continue
      }
      const input = message[rule.input]
      if (input === undefined) {
        continue
      }
      const match = rule.match.exec(input)
      if (!match) {
        continue
      }
      ruleId = rule.id
      const groups = match.groups ?? {}
      const captures = Object.fromEntries(
        Object.entries(groups).filter(([, value]) => value !== undefined),
      )
      const numbers: NumberConversion[] = []
      const conditions = rule.output.map((output) => output(groups, numbers))
      port.postMessage({
        ok: true,
        value: { ruleId, input, captures, numbers, conditions },
      })
      return
    }
    port.postMessage({ ok: true, value: null })
  } catch (error) {
    port.postMessage({
      ok: false,
      ruleId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
})
port.postMessage({ ready: true })
