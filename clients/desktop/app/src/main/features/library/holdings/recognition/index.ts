import { basename, extname, relative, sep } from 'node:path'
import { stat } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { DesktopError } from '@kisaki3/desktop-contracts/errors'
import {
  parseFileRecognitionDefinitionShape,
  type FileRecognitionDefinition,
  type FileRecognitionResult,
  type FileRecognitionSource,
  type FileWorkType,
} from '@kisaki3/desktop-contracts/library'
import type { NativeFiles } from '#native'
import { registeredRelation as comparePaths } from '../../../../infrastructure/files/registered-path'
import type { ChangeAdmission } from '../../../../infrastructure/use-targets'
import type { DatabaseCall } from '../../../../infrastructure/database/executor'
import type { CompleteWrite } from '../../transaction'
import type { FileWork } from '../files/storage'
import { openEvaluator, RecognitionOutputError } from './evaluator'
import { builtin } from './builtin'
import { matchParts, type Candidate } from './match'
import { partSet, type RecognitionPlan, type recognitionStorage } from './storage'
import type { Condition } from './output'
import type { Position } from '../positions'

type Failure = Extract<FileRecognitionResult, { outcome: 'failed' }>
function failed(
  reason: Failure['reason'],
  source: FileRecognitionSource | null,
  cause: unknown,
): Failure {
  return {
    outcome: 'failed',
    reason,
    source,
    error: {
      code: cause instanceof DesktopError ? cause.code : 'ReadFailed',
      message: cause instanceof Error ? cause.message : String(cause),
    },
  }
}
export function createRecognition(
  call: DatabaseCall<ReturnType<typeof recognitionStorage>>,
  native: NativeFiles,
  complete: CompleteWrite,
  admit: ChangeAdmission,
  worker: URL,
) {
  const waiting = new Set<string>()
  async function withRules<T>(
    signal: AbortSignal,
    action: (
      compile: (
        type: FileWorkType,
        definition: FileRecognitionDefinition,
      ) => ReturnType<typeof openEvaluator>,
    ) => Promise<T>,
  ) {
    const handles = new Map<string, ReturnType<typeof openEvaluator>>()
    function compile(type: FileWorkType, definition: FileRecognitionDefinition) {
      const key = JSON.stringify([type, definition])
      let pending = handles.get(key)
      if (!pending) {
        pending = openEvaluator(worker, type, definition, signal)
        handles.set(key, pending)
      }
      return pending
    }
    try {
      return await action(compile)
    } finally {
      await Promise.all(
        [...handles.values()].map((pending) =>
          pending.then(
            (execution) => execution.close(),
            () => {},
          ),
        ),
      )
    }
  }
  type Compile = (
    type: FileWorkType,
    definition: FileRecognitionDefinition,
  ) => ReturnType<typeof openEvaluator>
  async function inspect(
    work: FileWork,
    id: string,
    candidates: readonly Candidate[],
    signal: AbortSignal,
    compile: Compile,
    draft?: FileRecognitionDefinition,
  ): Promise<RecognitionPlan> {
    const baseline = await call('recognitionInput', work, id)
    const { file, roots } = baseline
    let profileId: string | null = null,
      definition: FileRecognitionDefinition | null = null
    function plan(result: FileRecognitionResult) {
      return { baseline, profileId, definition, result }
    }
    try {
      const value = await stat(file.path)
      if (file.kind === 'directory' ? !value.isDirectory() : !value.isFile()) {
        throw new DesktopError('FileUnavailable', 'The content kind changed')
      }
    } catch (cause) {
      signal.throwIfAborted()
      return plan(failed('unreadable', null, cause))
    }
    let root: (typeof roots)[number] | undefined
    for (const dir of roots) {
      signal.throwIfAborted()
      const relation = await comparePaths(dir.path, file.path, native)
      if (relation === 'unknown') {
        return plan(
          failed(
            'invalidConfiguration',
            null,
            new DesktopError(
              'PathUnresolved',
              'Cannot determine the directory containing this file',
            ),
          ),
        )
      }
      if (relation === 'same' || relation === 'contains') {
        if (root) {
          return plan(
            failed(
              'conflictingInterpretation',
              null,
              new DesktopError('PathConflict', 'Multiple registered directories contain this file'),
            ),
          )
        }
        root = dir
      }
    }
    const raw = basename(file.path),
      baseName = file.kind === 'directory' ? raw : basename(raw, extname(raw))
    const path = root
      ? [basename(root.path), ...relative(root.path, file.path).split(sep)]
          .filter(Boolean)
          .join('/')
      : undefined
    if (draft) {
      definition = draft
    } else if (root?.profileId) {
      profileId = root.profileId
      const profile = await call('readRecognitionProfile', work.type, profileId)
      if (profile?.definition.status !== 'ready') {
        return plan(
          failed(
            'invalidConfiguration',
            null,
            new DesktopError('InvalidQuery', 'The directory recognition profile cannot be used'),
          ),
        )
      }
      definition = profile.definition.value
    }
    const origin = (ruleId: string): FileRecognitionSource =>
      draft ? { type: 'draft', ruleId } : { type: 'profile', profileId: profileId!, ruleId }
    if (definition) {
      try {
        const evaluated = await (await compile(work.type, definition)).match(baseName, path)
        if (evaluated) {
          return plan(
            matchParts(work.type, evaluated.conditions, origin(evaluated.ruleId), candidates),
          )
        }
      } catch (cause) {
        if (signal.aborted || (cause instanceof DesktopError && cause.code === 'ResourceLimit')) {
          throw cause
        }
        if (cause instanceof RecognitionOutputError) {
          return plan(failed('invalidOutput', origin(cause.ruleId), cause))
        }
        return plan(failed('invalidConfiguration', null, cause))
      }
    }
    try {
      return plan(
        matchParts(work.type, builtin(work.type, baseName, path), { type: 'builtin' }, candidates),
      )
    } catch (cause) {
      return plan(failed('conflictingInterpretation', { type: 'builtin' }, cause))
    }
  }
  async function applyPlans(
    work: FileWork,
    plans: readonly RecognitionPlan[],
    automatic: boolean,
    signal: AbortSignal,
  ) {
    const writable = plans.filter(
      ({ result, baseline }) =>
        result.outcome === 'matched' &&
        (!automatic || (baseline.file.mode === 'automatic' && !baseline.links.length)) &&
        !isDeepStrictEqual(partSet(result.parts), partSet(baseline.links.map((link) => link.part))),
    )
    signal.throwIfAborted()
    return new Set(
      writable.length
        ? await admit(
            writable.map((p) => ({ type: 'file', kind: work.type, id: p.baseline.file.id })),
            async () => complete(await call('applyFileRecognition', work, writable, automatic)),
          )
        : [],
    )
  }
  type AutoResult = {
    recognition: FileRecognitionResult | null
    associationOutcome: 'updated' | 'unchanged' | 'notAttempted' | 'waitingForUse'
  }
  async function withAutomatic<T>(
    work: FileWork,
    signal: AbortSignal,
    action: (one: (id: string) => Promise<AutoResult>) => Promise<T>,
  ) {
    return withRules(signal, async (compile) => {
      let available: readonly Candidate[] | undefined
      async function one(id: string): Promise<AutoResult> {
        waiting.delete(id)
        const input = await call('recognitionInput', work, id)
        if (input.file.mode !== 'automatic' || input.links.length) {
          return { recognition: null, associationOutcome: 'notAttempted' }
        }
        available ??= await call('matchCandidates', work)
        const plan = await inspect(work, id, available, signal, compile)
        try {
          const changed = await applyPlans(work, [plan], true, signal)
          return {
            recognition: plan.result,
            associationOutcome: changed.has(id) ? 'updated' : 'unchanged',
          }
        } catch (cause) {
          if (cause instanceof DesktopError && cause.code === 'InUse') {
            waiting.add(id)
            return { recognition: null, associationOutcome: 'waitingForUse' }
          }
          throw cause
        }
      }
      return action(one)
    })
  }
  async function run(
    work: FileWork,
    ids: readonly string[],
    automatic: boolean,
    signal: AbortSignal,
  ) {
    return withRules(signal, async (compile) => {
      const available = await call('matchCandidates', work)
      const plans: RecognitionPlan[] = []
      for (const id of ids) {
        signal.throwIfAborted()
        plans.push(await inspect(work, id, available, signal, compile))
      }
      const changed = await applyPlans(work, plans, automatic, signal)
      return {
        work,
        files: plans.map((p) => ({
          fileId: p.baseline.file.id,
          result: p.result,
          changed: changed.has(p.baseline.file.id),
        })),
      }
    })
  }
  return {
    async preview(
      work: FileWork,
      root: string,
      paths: readonly string[],
      before: readonly Position[],
      profile: { id: string; definition: FileRecognitionDefinition } | null,
      signal: AbortSignal,
    ) {
      const available = await call('matchCandidates', work)
      return withRules(signal, async (compile) => {
        const items: { path: string; registered: boolean; result: FileRecognitionResult | null }[] =
          []
        const execution = profile ? await compile(work.type, profile.definition) : null
        for (const path of paths) {
          signal.throwIfAborted()
          const registered = before.some((row) => row.kind !== 'directory' && row.path === path)
          if (registered) {
            items.push({ path, registered, result: null })
            continue
          }
          let source: FileRecognitionSource = { type: 'builtin' }
          try {
            const file = await stat(path),
              name = file.isDirectory() ? basename(path) : basename(path, extname(path))
            const relativePath = [basename(root), ...relative(root, path).split(sep)]
              .filter(Boolean)
              .join('/')
            const hit = await execution?.match(name, relativePath)
            if (hit) {
              source = { type: 'profile', profileId: profile!.id, ruleId: hit.ruleId }
            }
            items.push({
              path,
              registered: false,
              result: matchParts(
                work.type,
                hit?.conditions ?? builtin(work.type, name, relativePath),
                source,
                available,
              ),
            })
          } catch (cause) {
            if (
              signal.aborted ||
              (cause instanceof DesktopError && cause.code === 'ResourceLimit')
            ) {
              throw cause
            }
            if (cause instanceof RecognitionOutputError && profile) {
              source = { type: 'profile', profileId: profile.id, ruleId: cause.ruleId }
            }
            items.push({
              path,
              registered: false,
              result: failed(
                cause instanceof RecognitionOutputError
                  ? 'invalidOutput'
                  : 'conflictingInterpretation',
                source,
                cause,
              ),
            })
          }
        }
        return items
      })
    },
    async testRecognition(work: FileWork, id: string, input: unknown, signal: AbortSignal) {
      if (
        !input ||
        typeof input !== 'object' ||
        Array.isArray(input) ||
        Object.keys(input).some((k) => k !== 'definition')
      ) {
        throw new DesktopError('InvalidInput', 'Invalid recognition test')
      }
      const definition =
        'definition' in input
          ? parseFileRecognitionDefinitionShape(work.type, input.definition)
          : undefined
      return withRules(
        signal,
        async (compile) =>
          (
            await inspect(
              work,
              id,
              await call('matchCandidates', work),
              signal,
              compile,
              definition,
            )
          ).result,
      )
    },
    async explain(
      type: FileWorkType,
      raw: unknown,
      baseName: string,
      path: string | undefined,
      signal: AbortSignal,
    ) {
      const definition = parseFileRecognitionDefinitionShape(type, raw)
      return withRules(signal, async (compile) => {
        const hit = await (await compile(type, definition)).match(baseName, path)
        if (hit) {
          return {
            source: { type: 'draft' as const, ruleId: hit.ruleId },
            input: hit.input,
            captures: hit.captures,
            numbers: hit.numbers,
            conditions: hit.conditions,
          }
        }
        const conditions: Condition[] = builtin(type, baseName, path)
        return {
          source: conditions.length ? { type: 'builtin' as const } : null,
          input: baseName,
          captures: {},
          numbers: [],
          conditions,
        }
      })
    },
    reidentify: (work: FileWork, ids: readonly string[], signal: AbortSignal) =>
      run(work, ids, false, signal),
    consumeWaiting: (id: string) => waiting.delete(id),
    clearWaiting: () => waiting.clear(),
    withAutomatic,
    automatic: (work: FileWork, id: string, signal: AbortSignal) =>
      withAutomatic(work, signal, (one) => one(id)),
  }
}
