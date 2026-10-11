/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OAuth client ID (Google Identity Services). */
  readonly VITE_GOOGLE_CLIENT_ID: string;
  /** API key restricted to the Picker API. Never sent to the Sheets API. */
  readonly VITE_GOOGLE_API_KEY: string;
  /** Cloud project number, so files picked are granted to this app (drive.file). */
  readonly VITE_GOOGLE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
