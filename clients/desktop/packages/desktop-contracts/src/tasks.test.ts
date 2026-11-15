/** @fileoverview Checks terminal task capabilities and legal finished-event values. */

import { expect, test } from 'vite-plus/test'
import { parseTaskState } from './tasks'
import { parseNativeEventPayload } from './events'
import { DesktopError } from './errors'

test('terminal task states and finish events retain consistent capabilities and failures', () => {
  expect(() =>
    parseTaskState({
      taskRunId: 't',
      status: 'completed',
      progress: null,
      canPause: false,
      canResume: false,
      canCancel: true,
    }),
  ).toThrow(DesktopError)

  expect(() =>
    parseNativeEventPayload('tasks.finished', {
      taskRunId: 't',
      type: 'example',
      status: 'failed',
      result: null,
      error: null,
      finishedAt: 3,
    }),
  ).toThrow(DesktopError)
})
