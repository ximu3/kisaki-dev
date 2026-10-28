/**
 * @fileoverview Public Node entry for launching and controlling a development application
 * over parent-child IPC.
 */

export { launchDevelopmentApplication } from './extension/development-application'
export type {
  DevelopmentApplication,
  DevelopmentApplicationOptions,
  DevelopmentProcessExit,
} from './extension/development-application'
