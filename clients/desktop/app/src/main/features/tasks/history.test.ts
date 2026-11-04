/** @fileoverview Verifies history behavior using isolated synthetic inputs. */

import { test, expect } from 'vitest'

import { parseTaskState } from '@kisaki3/desktop-contracts/tasks'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import { projectTaskHistory } from './history'
import { parseNativeEventPayload } from '@kisaki3/desktop-contracts/events'

test('terminal task affordances and historical interruption never manufacture resumed work or lost results', () => {
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

  const run = {
    id: 't',
    type: 'example',
    title: 'Example',
    description: null,
    status: 'running' as const,
    input: {},
    result: { saved: true },
    error: null,
    createdAt: 1,
    startedAt: 2,
    finishedAt: null,
  }

  expect(projectTaskHistory(run, false)).toEqual({ ...run, status: 'interrupted' })
  expect(projectTaskHistory(run, true)).toBe(run)

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
