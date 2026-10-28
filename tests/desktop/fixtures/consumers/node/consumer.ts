/**
 * @fileoverview Exercises public desktop package entries and declarations from an isolated
 * Node consumer.
 */

import { defineConfig } from '@kisaki3/extension-cli/config'
import { launchDevelopmentApplication } from '@kisaki3/extension-cli/extension'
import {
  developmentProtocolVersion,
  parseDevelopmentCommand,
} from '@kisaki3/desktop-contracts/development'
import { appearanceTokenNames } from '@kisaki3/appearance'
import type { ErrorSummary, ExecutionFailure } from '@kisaki3/extension-sdk'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { MessageTransport } from '@kisaki3/rpc'

const summary: ErrorSummary = { code: 'InvalidInput', message: 'Synthetic input' }
const failure: ExecutionFailure<{ count: number }> = { ...summary, partialResult: { count: 1 } }
const text: LocalizedText = { en: 'Consumer', 'zh-Hans': '消费者' }
const config = defineConfig({ entry: 'src/entry.ts' })
const transport: MessageTransport | undefined = undefined

const initialization = parseDevelopmentCommand({
  type: 'initialize',
  protocolVersion: developmentProtocolVersion,
})
if (typeof launchDevelopmentApplication !== 'function' || initialization.type !== 'initialize') {
  throw new Error('Development entries are unavailable')
}

// @ts-expect-error Failure codes are text, not implicit numeric database codes.
const invalid: ErrorSummary = { code: 1, message: 'invalid' }

console.info(
  'consumer-ready',
  appearanceTokenNames.length,
  failure.partialResult?.count,
  text,
  config.entry,
  transport,
  invalid.message,
)
