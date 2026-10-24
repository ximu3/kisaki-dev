/** A safe, serializable failure description; callers classify by code, never by message. */
export interface ErrorSummary {
  code: string
  message: string
}

/** A failed invocation may retain the result already established by that operation. */
export interface ExecutionFailure<Result> extends ErrorSummary {
  partialResult?: Result
}
