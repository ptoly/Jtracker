import { StorageError } from '../storage/errors';
import { loadScript } from './loadScript';

const GAPI_SRC = 'https://apis.google.com/js/api.js';
const SPREADSHEET_MIME = 'application/vnd.google-apps.spreadsheet';

let pickerReady: Promise<void> | null = null;

/** Loads the Picker library; safe to call early (e.g. when the Connect button is hovered). */
export function preloadPicker(): Promise<void> {
  pickerReady ??= loadScript(GAPI_SRC)
    .then(
      () =>
        new Promise<void>((resolve, reject) => {
          gapi.load('picker', { callback: resolve, onerror: reject });
        }),
    )
    .catch((error: unknown) => {
      pickerReady = null;
      throw error;
    });
  return pickerReady;
}

/**
 * Opens the Google Picker on spreadsheets. Picking a file grants Jtracker
 * (drive.file) access to it. Resolves to null if the user cancels.
 * The API key goes only to the Picker, never to the Sheets API.
 */
export async function pickSpreadsheet(
  oauthToken: string,
): Promise<{ id: string; name: string } | null> {
  try {
    await preloadPicker();
  } catch {
    throw new StorageError(
      'network',
      'Couldn’t load the Google file picker. Check your connection.',
    );
  }
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
      .setMimeTypes(SPREADSHEET_MIME)
      .setIncludeFolders(false);
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(oauthToken)
      .setDeveloperKey(import.meta.env.VITE_GOOGLE_API_KEY)
      .setAppId(import.meta.env.VITE_GOOGLE_APP_ID)
      .setTitle('Choose your job applications sheet')
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs?.[0];
          picker.dispose();
          resolve(doc ? { id: doc.id, name: doc.name } : null);
        } else if (data.action === google.picker.Action.CANCEL) {
          picker.dispose();
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}
