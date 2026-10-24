/** Private launcher control, available only in unpackaged development processes. */
export type DevelopmentControl = { type: 'shutdown' }

/** Actual application readiness, after host startup and renderer loading. */
export interface DevelopmentReady {
  type: 'ready'
  buildId: string
}
