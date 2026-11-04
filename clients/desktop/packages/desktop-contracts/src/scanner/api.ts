/** @fileoverview Composes scanner configuration, recognition and execution APIs with observable state. */

import type { ErrorSummary } from '../errors'
import type { TaskRunRef } from '../tasks'
import type { ScanConfigsApi } from './configs'
import type { ScanRunsApi, ScanResult } from './runs'
import type { WorkRecognizersApi } from './recognizers'
import type { ScanPreviewInput, ScanPreviewResult } from './preview'
import type { CallOptions, Listener, Disposable } from '../operations'
import { parseValue, id } from '../validation'
import * as v from 'valibot'
import { error } from './runs'
import { parseTaskRunRef } from '../tasks'

/** Watch availability and managed work are separate. Removing a config does not end an already accepted currentRun. */
export interface ScannerState {
  readonly watch:
    | { readonly status: 'disabled' | 'starting' | 'active'; readonly error: null }
    | { readonly status: 'unavailable'; readonly error: ErrorSummary }
  readonly currentRun: { readonly scanRunId: string; readonly taskRef: TaskRunRef } | null
}

/** Public scan is always full-config execution. Progress/control use the one actual taskRef exposed in currentRun. */
export interface ScannerApi {
  readonly configs: ScanConfigsApi
  readonly runs: ScanRunsApi
  readonly recognizers: WorkRecognizersApi

  preview(input: ScanPreviewInput, call?: CallOptions): Promise<ScanPreviewResult>
  scan(configId: string, call?: CallOptions): Promise<ScanResult>

  getState(configId: string, call?: CallOptions): Promise<ScannerState | null>
  observe(
    configId: string,
    listener: Listener<ScannerState | null>,
    call?: CallOptions,
  ): Promise<Disposable>
}

/** Watch failures and scan failures are independent; observation release never controls the current task. */
export function parseScannerState(input: unknown): ScannerState | null {
  return parseValue(
    v.nullable(
      v.strictObject({
        watch: v.union([
          v.strictObject({
            status: v.picklist(['disabled', 'starting', 'active']),
            error: v.null(),
          }),
          v.strictObject({ status: v.literal('unavailable'), error }),
        ]),
        currentRun: v.nullable(
          v.strictObject({
            scanRunId: id,
            taskRef: v.pipe(v.unknown(), v.transform(parseTaskRunRef)),
          }),
        ),
      }),
    ),
    input,
    'Invalid scanner state',
  )
}
