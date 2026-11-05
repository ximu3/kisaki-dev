/** @fileoverview Publishes the scanner capability contract. */

export {
  parseScanDefinitionShape,
  parseScanDefinition,
  parseScanConfigCreate,
  parseScanConfigUpdate,
  parseScanConfigSnapshot,
} from './configs'

export { parseRecognitionInput, parseRecognitionResult } from './recognizers'

export { parseScanResult, requireCompleteScanResult, parseScanRun, parseScanRunQuery } from './runs'

export { parseScannerState } from './api'

export { parseClueExtractionRule, parseClueExtractionRuleShape } from './rules'

export type { PathFilter } from '../paths'
export type {
  ScanConfigsApi,
  ScanDefinition,
  ScanConfigFields,
  ScanConfig,
  ScanConfigCreate,
  ScanConfigUpdate,
  ScanConfigSnapshot,
} from './configs'
export type {
  ScanRunsApi,
  ScanScope,
  ScanDiscovery,
  ScanLocalContentResult,
  ScanCandidateResult,
  ScanResult,
  ScanRunStatus,
  ScanRun,
  ScanRunSummary,
  ScanRunQuery,
} from './runs'
export type {
  WorkRecognizersApi,
  RecognitionInput,
  WorkRecognizer,
  WorkRecognizerDescriptor,
} from './recognizers'
export type { ScannerApi, ScannerState } from './api'
export type {
  ClueExtractionOutput,
  ClueExtractionRule,
  ClueExtractionResult,
  ClueExtractionPreset,
} from './rules'

export type { ScanPreviewInput, ScanPreviewPath, ScanPreviewResult } from './preview'
