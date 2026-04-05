import { getSettings } from '../../storage/index';

// Microsoft identity platform endpoints (common tenant = personal + work).
const AUTHORITY = 'https://login.microsoftonline.com/common';
const AUTH_URL = `${AUTHORITY}/oauth2/v2.0/authorize`;
const TOKEN_URL = `${AUTHORITY}/oauth2/v2.0/token`;

// `offline_access` is required to receive a refresh token. The other scopes
// cover calendar event creation and basic profile for the connection UI.
const SCOPES = 'https://graph.microsoft.com/Calendars.ReadWrite offline_access openid profile User.Read';

const STORAGE_KEY = 'msTokens';

interface MSTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // epoch ms
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(text: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function loadTokens(): Promise<MSTokens | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      resolve((result[STORAGE_KEY] as MSTokens | undefined) ?? null);
    });
  });
}

async function saveTokens(tokens: MSTokens): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: tokens }, () => resolve());
  });
}

async function clearTokens(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove(STORAGE_KEY, () => resolve());
  });
}

async function getClientId(): Promise<string> {
  const settings = await getSettings();
  const clientId = settings.microsoftClientId?.trim();
  if (!clientId) {
    throw new Error(
      'Microsoft client ID not configured. Register an Azure AD app and paste the client (application) ID in settings.',
    );
  }
  return clientId;
}

async function exchangeCodeForTokens(
  clientId: string,
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<MSTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
    scope: SCOPES,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Microsoft token exchange failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

async function refreshWithRefreshToken(
  clientId: string,
  refreshToken: string,
): Promise<MSTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`Microsoft token refresh failed (${res.status})`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    // MS may or may not rotate refresh tokens — fall back to the old one.
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
}

async function authorizeInteractive(): Promise<MSTokens> {
  const clientId = await getClientId();
  const redirectUri = chrome.identity.getRedirectURL();

  // PKCE: generate verifier + challenge per auth attempt.
  const verifier = base64UrlEncode(randomBytes(32));
  const challenge = base64UrlEncode(await sha256(verifier));
  const state = base64UrlEncode(randomBytes(16));

  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('prompt', 'select_account');

  const redirectResult = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });

  if (!redirectResult) {
    throw new Error('Microsoft authorization canceled.');
  }

  const url = new URL(redirectResult);
  const returnedState = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  if (error) {
    throw new Error(`Microsoft auth error: ${error}${errorDesc ? ` - ${errorDesc}` : ''}`);
  }
  if (returnedState !== state) {
    throw new Error('State mismatch in Microsoft OAuth redirect.');
  }
  if (!code) {
    throw new Error('No authorization code returned from Microsoft.');
  }

  const tokens = await exchangeCodeForTokens(clientId, code, verifier, redirectUri);
  await saveTokens(tokens);
  return tokens;
}

/**
 * Returns a valid Microsoft access token, refreshing or re-prompting the
 * user as needed. Mirrors the shape of getAuthToken() in the Google module.
 */
export async function getMicrosoftAuthToken(): Promise<string> {
  const existing = await loadTokens();

  // Cached token still valid (60s safety margin)
  if (existing && existing.expiresAt > Date.now() + 60_000) {
    return existing.accessToken;
  }

  // Try silent refresh
  if (existing?.refreshToken) {
    try {
      const clientId = await getClientId();
      const refreshed = await refreshWithRefreshToken(clientId, existing.refreshToken);
      await saveTokens(refreshed);
      return refreshed.accessToken;
    } catch {
      // Fall through to interactive
    }
  }

  const fresh = await authorizeInteractive();
  return fresh.accessToken;
}

/**
 * Forces a fresh token. Called after a 401 from Graph to recover from a
 * stale token. Mirrors refreshAuthToken() in the Google module.
 */
export async function refreshMicrosoftAuthToken(): Promise<string> {
  const existing = await loadTokens();
  if (existing?.refreshToken) {
    try {
      const clientId = await getClientId();
      const refreshed = await refreshWithRefreshToken(clientId, existing.refreshToken);
      await saveTokens(refreshed);
      return refreshed.accessToken;
    } catch {
      // Refresh failed — fall through to interactive
    }
  }
  const fresh = await authorizeInteractive();
  return fresh.accessToken;
}

/**
 * Clears the local copy of Microsoft tokens. Microsoft's OAuth flow
 * doesn't expose a RFC 7009 revocation endpoint, so local cleanup is
 * all we can do — remaining tokens expire on their own.
 */
export async function revokeMicrosoftAuthToken(): Promise<void> {
  await clearTokens();
}

export async function isMicrosoftConnected(): Promise<boolean> {
  const tokens = await loadTokens();
  return !!tokens?.accessToken;
}
