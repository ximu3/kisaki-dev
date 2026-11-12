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

/**
 * Watch readiness and the currently accepted managed scan for a configuration.
 *
 * Removing the configuration leaves an accepted run alive until its own completion.
 */
export interface ScannerState {
  readonly watch:
    | { readonly status: 'disabled' | 'starting' | 'active'; readonly error: null }
    | { readonly status: 'unavailable'; readonly error: ErrorSummary }
  readonly currentRun: { readonly scanRunId: string; readonly taskRef: TaskRunRef } | null
}

/**
 * Scanner configuration, preview, recognition and full-configuration execution.
 *
 * Runtime progress and control use the accepted run's actual task reference.
 */
export interface ScannerApi {
  readonly configs: ScanConfigsApi
  readonly runs: ScanRunsApi
  readonly recognizers: WorkRecognizersApi

  /**
   * Previews draft path discovery and native clue extraction.
   *
   * It saves no configuration, entry or ScanRun and acquires no remote metadata.
   */
  preview(input: ScanPreviewInput, call?: CallOptions): Promise<ScanPreviewResult>

  /**
   * Executes the complete saved configuration and returns its actual report.
   *
   * Runtime progress and control use the current task reference.
   */
  scan(configId: string, call?: CallOptions): Promise<ScanResult>

  /**
   * Reads watch readiness and accepted scan state, returning null when no scanner state remains.
   */
  getState(configId: string, call?: CallOptions): Promise<ScannerState | null>

  /**
   * Delivers current scanner state and subsequent changes and returns the observation lifetime.
   *
   * Ending observation leaves its watch and accepted scan running.
   */
  observe(
    configId: string,
    listener: Listener<ScannerState | null>,
    call?: CallOptions,
  ): Promise<Disposable>
}

/**
 * Parses watch readiness and the independent accepted-run reference, or an absent scanner state.
 */
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
