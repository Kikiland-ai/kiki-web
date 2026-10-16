import { ConnectionConfigError } from './connection-config';
// Compatibility import path for the working screens; definitions live in one place.
export type { Identity, AuthService, AuthDriver, LearnerApi, Services, SignOutCleanup } from '../contracts/services';

export class ServiceError extends Error {
  constructor(message: string, public status?: number) { super(message); this.name = 'ServiceError'; }
}
export function readableError(error: unknown): string {
  if (error instanceof ServiceError || error instanceof ConnectionConfigError) return error.message;
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Sign-in was cancelled. You can try again.';
  if (code === 'auth/popup-blocked') return 'Your browser blocked the sign-in window. Try the Google redirect option below.';
  if (code === 'auth/network-request-failed' || error instanceof TypeError) return 'We could not connect. Check your connection and try again.';
  if (code === 'auth/unauthorized-domain') return 'Google sign-in is not configured for this app address yet.';
  if (code === 'auth/operation-not-allowed') return 'Google sign-in needs to be enabled for this app.';
  return 'This could not be completed. Please try again.';
}
