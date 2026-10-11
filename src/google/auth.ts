import { StorageError } from '../storage/errors';
import { loadScript } from './loadScript';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
/** Access only to files the user opens with Jtracker (through the Picker). */
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
/** Renew this long before the token expires, so a request never starts with a dying token. */
const RENEW_MARGIN_MS = 60_000;

const signInError = new StorageError(
  'auth',
  'Google sign-in didn’t finish. Use Reconnect, then try again.',
);

// The token lives only in memory: a reload means signing in again.
let client: google.accounts.oauth2.TokenClient | null = null;
let token: { value: string; expiresAt: number } | null = null;
let pending: {
  promise: Promise<string>;
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
} | null = null;

function settle(result: { token: string } | { error: unknown }) {
  const current = pending;
  pending = null;
  if (!current) return;
  if ('token' in result) current.resolve(result.token);
  else current.reject(result.error);
}

function handleResponse(response: google.accounts.oauth2.TokenResponse) {
  if (response.error || !google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) {
    settle({ error: signInError });
    return;
  }
  token = { value: response.access_token, expiresAt: Date.now() + response.expires_in * 1000 };
  settle({ token: token.value });
}

/**
 * Loads Google Identity Services ahead of a click, so the sign-in popup opens
 * straight from the click (browsers block popups that open much later).
 */
export async function preloadAuth(): Promise<void> {
  await loadScript(GIS_SRC);
  client ??= google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    scope: SCOPE,
    callback: handleResponse,
    error_callback: () => settle({ error: signInError }),
  });
}

function requestToken(prompt?: '', { replace = false } = {}): Promise<string> {
  if (pending && !replace) return pending.promise;
  // A popup that never reported back shouldn't block a fresh sign-in.
  if (pending) settle({ error: signInError });
  if (!client) return Promise.reject(signInError);
  let resolve!: (token: string) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  pending = { promise, resolve, reject };
  client.requestAccessToken(prompt === undefined ? {} : { prompt });
  return promise;
}

/** Interactive sign-in (Connect / Reconnect). Call from a click. */
export async function signIn(): Promise<string> {
  try {
    await preloadAuth();
  } catch {
    throw new StorageError('network', 'Couldn’t load Google sign-in. Check your connection.');
  }
  return requestToken(undefined, { replace: true });
}

/** True while there's a token that won't expire in the next minute. */
export function hasValidToken(): boolean {
  return token !== null && token.expiresAt - Date.now() > RENEW_MARGIN_MS;
}

/**
 * The current token, renewed without a prompt when it's about to expire (or when
 * `renew` is set, after a 401). Google may still need a popup to renew; if the
 * browser blocks it, this rejects with an auth error.
 */
export function getToken({ renew = false } = {}): Promise<string> {
  if (!renew && token && hasValidToken()) return Promise.resolve(token.value);
  token = null;
  return requestToken('');
}

/** Forgets the token and revokes it with Google. */
export function signOut(): void {
  if (token && typeof google !== 'undefined') google.accounts.oauth2.revoke(token.value);
  token = null;
}
