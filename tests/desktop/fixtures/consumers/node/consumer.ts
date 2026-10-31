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
import {
  parseCalendarDate,
  parseDeeplink,
  formatDeeplink,
  parseStorageCommit,
  type ErrorSummary,
  type ExecutionFailure,
  type ExtensionModule,
  type WebviewContext,
  type AnimeOpenInput,
} from '@kisaki3/extension-sdk'
import { parseNodeAccepted, parseWebviewAccepted } from '@kisaki3/extension-api/protocol'
import { deepStrictEqual, throws } from 'node:assert/strict'
import type { LocalizedText } from '@kisaki3/extension-distribution/metadata'
import type { MessageTransport } from '@kisaki3/rpc'

const summary: ErrorSummary = { code: 'InvalidInput', message: 'Synthetic input' }
const failure: ExecutionFailure<{ count: number }> = { ...summary, partialResult: { count: 1 } }
const text: LocalizedText = { en: 'Consumer', 'zh-Hans': '消费者' }
const config = defineConfig({ entry: 'src/entry.ts' })
const transport: MessageTransport | undefined = undefined

deepStrictEqual(parseCalendarDate({ year: 2024, month: 2, day: 29 }), {
  year: 2024,
  month: 2,
  day: 29,
})
const deeplink = {
  type: 'extension',
  extensionId: 'author.reader',
  path: ['open', 'a/b'],
  query: [
    ['tag', 'a'],
    ['tag', 'b'],
  ],
} as const
deepStrictEqual(parseDeeplink(formatDeeplink(deeplink)), deeplink)
const commit = {
  values: [{ type: 'set', key: 'account', value: 'synthetic', expectedRevision: null }],
  secrets: [{ type: 'set', key: 'account', value: { token: 'synthetic' } }],
} as const
deepStrictEqual(parseStorageCommit(commit), commit)
throws(() => parseStorageCommit({ values: [commit.values[0], commit.values[0]] }))
deepStrictEqual(
  parseNodeAccepted({ apiVersion: '1.2.3+build.4', instanceId: 'instance' }, '^1.0.0'),
  { apiVersion: '1.2.3+build.4', instanceId: 'instance' },
)
throws(() =>
  parseWebviewAccepted(
    { apiVersion: '2.0.0', instanceId: 'instance', viewId: 'view', documentId: 'document' },
    '^1.0.0',
  ),
)

/** Typecheck an author entry without claiming to start a host or activate an extension. */
export const extension: ExtensionModule = {
  async activate(context) {
    const dispose = await context.events.on('library.changed', () => {})
    context.onDispose(() => dispose.dispose())

    // @ts-expect-error Native installation management is not part of the author context.
    void context.extensions
    // @ts-expect-error Native recording recovery does not become a general extension capability.
    void context.sessions.recordings
  },
}

/** Check the frontend's narrower declared capability independently from Node activation. */
export function inspectWebview(context: WebviewContext): string {
  // @ts-expect-error A Webview has no raw private credential storage.
  void context.storage
  return context.i18n.locale.get()
}

// @ts-expect-error A position cannot be applied without an explicit actual file.
const invalidOpen: AnimeOpenInput = { animeId: 'work', position: 10 }

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
  invalidOpen,
)
