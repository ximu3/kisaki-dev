import { DesktopError, type ErrorSummary } from '@kisaki3/desktop-contracts/errors'
import {
  parseLocalContentInput,
  parseLocalContentRegistrationOptions,
  parseWorkRef,
  type LocalContentRegistrationResult,
  type WorkRef,
  type WorkType,
} from '@kisaki3/desktop-contracts/library'
import type { CallOptions } from '@kisaki3/desktop-contracts/operations'
import { fileError } from '../errors'
import type { createRefresh } from '../maintenance/refresh'
import type { createRecognition } from '../recognition'
import { callSignal, fileWork } from '../work'
import type { createRegistration } from './queue'

export function localContentRegistration(
  register: ReturnType<typeof createRegistration>,
  refresh: ReturnType<typeof createRefresh>,
  recognition: ReturnType<typeof createRecognition>,
) {
  return async function registerLocalContent<T extends WorkType>(
    raw: WorkRef<T>,
    input: unknown,
    options: unknown = {},
    context?: CallOptions,
  ): Promise<LocalContentRegistrationResult<T>> {
    const signal = callSignal(context)
    const work = parseWorkRef(raw),
      value = parseLocalContentInput(input),
      { expectedIdentities } = parseLocalContentRegistrationOptions(options ?? {})
    if (work.type === 'game' && value.type === 'file') {
      return register.game(
        { type: 'game', id: work.id },
        value.path,
        signal,
        expectedIdentities,
      ) as Promise<LocalContentRegistrationResult<T>>
    }
    const saved =
      value.type === 'directory'
        ? await register.directory(work, { path: value.path }, signal, expectedIdentities)
        : await register.file(fileWork(work), { path: value.path }, signal, expectedIdentities)
    const issues: { code: 'initialRefreshFailed'; error: ErrorSummary }[] = []
    const result = {
      work,
      registrations: [
        {
          type: value.type,
          id: saved.id,
          outcome: saved.created ? 'registered' : 'alreadyRegistered',
        },
      ],
      issues,
    } as LocalContentRegistrationResult
    if (saved.created && work.type !== 'game') {
      const target = { type: work.type, id: work.id }
      try {
        if (value.type === 'directory') {
          const report = await refresh(target, signal)
          for (const issue of report.discovery.issues) {
            issues.push({ code: 'initialRefreshFailed', error: issue.error })
          }
        } else {
          const report = await recognition.automatic(target, saved.id, signal)
          if (report.recognition?.outcome === 'failed') {
            issues.push({ code: 'initialRefreshFailed', error: report.recognition.error })
          }
        }
      } catch (cause) {
        if (signal.aborted) {
          throw new DesktopError('Cancelled', 'Initial content checking was cancelled', {
            cause,
            partialResult: result,
          })
        }
        issues.push({ code: 'initialRefreshFailed', error: fileError(cause) })
      }
    }
    return result as LocalContentRegistrationResult<T>
  }
}
