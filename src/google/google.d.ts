// The parts of Google Identity Services and the Google Picker that Jtracker
// uses. Both load as scripts (see loadScript.ts), so they're globals.

declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    error?: string;
    error_description?: string;
  }

  interface ClientConfigError {
    type: 'popup_failed_to_open' | 'popup_closed' | 'unknown';
    message: string;
  }

  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: ClientConfigError) => void;
  }

  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: '' | 'none' | 'consent' | 'select_account' }): void;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;
  function hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
  function revoke(token: string, done?: () => void): void;
}

declare namespace google.picker {
  enum ViewId {
    SPREADSHEETS = 'spreadsheets',
  }

  enum Action {
    PICKED = 'picked',
    CANCEL = 'cancel',
  }

  interface PickedDocument {
    id: string;
    name: string;
  }

  interface ResponseObject {
    action: string;
    docs?: PickedDocument[];
  }

  class DocsView {
    constructor(viewId?: ViewId);
    setMimeTypes(mimeTypes: string): DocsView;
    setIncludeFolders(include: boolean): DocsView;
  }

  interface Picker {
    setVisible(visible: boolean): Picker;
    dispose(): void;
  }

  class PickerBuilder {
    addView(view: DocsView): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    setTitle(title: string): PickerBuilder;
    setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
    build(): Picker;
  }
}

declare namespace gapi {
  function load(api: 'picker', options: { callback: () => void; onerror: () => void }): void;
}
