/**
 * Build-time configuration for the Microsoft Calendar provider.
 *
 * The client ID below is baked into the extension at build time from the
 * VITE_MICROSOFT_CLIENT_ID environment variable (see .env.example). This
 * lets the distributed extension ship with a single "DoseSync" Azure AD
 * application registration that end users can connect to without having
 * to register their own app — the original requirement was impractical
 * for non-technical users.
 *
 * The client ID is NOT a secret. Public OAuth clients (SPA / desktop
 * apps using PKCE) are designed to have their client ID embedded in the
 * distributed binary; security comes from the PKCE flow, not from
 * hiding the ID. See RFC 7636 and Azure AD "public client" docs.
 *
 * If the env var is missing at build time, the constant will be an empty
 * string and the UI will fall back to the legacy "paste your own client
 * ID" path so developers can still test locally without setting up env.
 */
export const BUILD_MICROSOFT_CLIENT_ID: string =
  (import.meta.env?.['VITE_MICROSOFT_CLIENT_ID'] as string | undefined)?.trim() ?? '';

/**
 * Whether the extension was built with a bundled client ID. When true,
 * the Settings UI hides the "Azure AD client ID" input entirely.
 */
export const HAS_BUNDLED_CLIENT_ID = BUILD_MICROSOFT_CLIENT_ID.length > 0;
