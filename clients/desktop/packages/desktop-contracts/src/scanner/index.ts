/** @fileoverview Exposes scanner intent, recognition participation, actual reports, and independent runtime/history reads. */

export type { ClueOutput, ClueExtractionRule } from './rules'
export { parseClueExtractionRule, validateClueOutputReferences, expandClueOutput } from './rules'
export type {
  RecognitionInput,
  WorkRecognizerDescription,
  WorkRecognizer,
  WorkRecognizersApi,
} from './recognizers'
export type {
  ScanDefinition,
  ScanConfigFields,
  ScanConfig,
  ScanConfigSummary,
  ScanConfigCreate,
  ScanConfigUpdate,
  ScanConfigsApi,
} from './configs'
export {
  parseScanDefinition,
  createScanDefinition,
  parseScanConfigCreate,
  parseScanConfigUpdate,
} from './configs'
export type {
  ScanDiscovery,
  ExistingContentOutcome,
  ScanCandidateResult,
  ScanResult,
  ScannerState,
  ScanConfigSnapshot,
  ScanScope,
  ScanRunStatus,
  ScanRun,
  ScanRunSummary,
  ScanRunQuery,
  ScanRunsApi,
  ScanPreviewInput,
  ScanPreviewItem,
  ScanPreviewResult,
  ScanFinishedEvent,
  ScannerApi,
} from './api'
