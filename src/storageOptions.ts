/**
 * Which ways to store applications this build offers, from
 * VITE_STORAGE_OPTIONS (a comma list of demo, csv, google; all three when
 * unset). Google also needs its VITE_GOOGLE_* values, or it's left out.
 * The hosted demo builds with --mode dreamhost (.env.dreamhost: demo,csv).
 */
export type StorageOption = 'demo' | 'csv' | 'google';

const ALL: readonly StorageOption[] = ['demo', 'csv', 'google'];

export function parseStorageOptions(
  value: string | undefined,
  googleConfigured: boolean,
): ReadonlySet<StorageOption> {
  const listed = value?.trim()
    ? value
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter((part): part is StorageOption => (ALL as readonly string[]).includes(part))
    : [...ALL];
  const options = new Set(listed);
  if (!googleConfigured) options.delete('google');
  // Something has to hold the applications: the demo, when nothing else is left.
  if (options.size === 0) options.add('demo');
  return options;
}

const env = import.meta.env;

export const googleConfigured = Boolean(
  env.VITE_GOOGLE_CLIENT_ID && env.VITE_GOOGLE_API_KEY && env.VITE_GOOGLE_APP_ID,
);

export const storageOptions = parseStorageOptions(env.VITE_STORAGE_OPTIONS, googleConfigured);
