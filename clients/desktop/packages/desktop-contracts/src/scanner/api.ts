import type { ErrorSummary } from '../errors'
import type { ScanConfigsApi } from './configs'
import type { WorkRecognizersApi } from './recognizers'
import type { ScanPreviewInput, ScanPreviewResult } from './preview'
import type { CallOptions, Listener, Disposable } from '../operations'
import { fromParser, parseValue, id } from '../validation'
import * as v from 'valibot'
import { error, type ScanRunsApi, type ScanResult } from './runs'
import { parseTaskRunRef, type TaskRunRef } from '../tasks'

export interface ScannerState {
  readonly watch:
    | { readonly status: 'disabled' | 'starting' | 'active'; readonly error: null }
    | { readonly status: 'unavailable'; readonly error: ErrorSummary }
  readonly currentRun: { readonly scanRunId: string; readonly taskRef: TaskRunRef } | null
}

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
            taskRef: fromParser(parseTaskRunRef),
          }),
        ),
      }),
    ),
    input,
    'Invalid scanner state',
  )
}
