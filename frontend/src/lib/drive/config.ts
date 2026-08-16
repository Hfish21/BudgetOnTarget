/**
 * Google Drive integration config.
 *
 * These two values are **public by design** and safe to commit:
 *  - The OAuth Client ID identifies the app to Google; it is meant to ship in
 *    frontend JavaScript. There is no client secret (we use the browser-only
 *    implicit token flow, so no secret exists).
 *  - The API key is used only by the Google Picker. It is locked server-side to
 *    the `budgetontarget.com` + `localhost:3000` HTTP referrers and to the
 *    Picker API alone, so it is inert anywhere else.
 *
 * Both can be overridden at build time via NEXT_PUBLIC_* env vars (useful for a
 * fork that wants its own Google Cloud project) but the committed defaults let
 * CI build the production site with no secret wiring.
 */
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
  "40550510031-c3kptg4cjtunkvf8e9ic268toq0cu29c.apps.googleusercontent.com";

export const GOOGLE_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_API_KEY ??
  "AIzaSyCO9eLjtrQoOwHhZ7Hiz-fk2VXKBCJxGpM";

/** Google Cloud project number, used by the Picker to scope shown files. */
export const GOOGLE_APP_ID =
  process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "40550510031";

/**
 * The narrowest useful Drive scope: the app can only touch files the user
 * explicitly picks or that the app itself creates. Google (and our code) never
 * sees the rest of the user's Drive.
 */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** Drive stores our files as plain JSON. */
export const BUDGET_MIME_TYPE = "application/json";

/**
 * Whether the Drive feature should be offered in the UI. False only if a fork
 * strips the credentials, so we never render broken "Open from Drive" buttons.
 */
export const isDriveConfigured = (): boolean =>
  Boolean(GOOGLE_CLIENT_ID && GOOGLE_API_KEY);
