import type { ApiErrorCode } from '../contracts'

/**
 * A failed service call, carrying the contract's error code. Fixture adapters
 * throw it the way the real API adapter will once it unwraps `{ error }`.
 * Proposed for src/contracts so both adapters share it; kept here until agreed.
 */
export class ServiceError extends Error {
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
  }
}
