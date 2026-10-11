import { STATUSES, type Application } from '../../types/application';

/**
 * Options for a status <select>. A status the sheet had that Jtracker doesn't
 * know shows as a disabled first option, so the select still reflects the
 * row until a real status is picked.
 */
export function StatusOptions({ app }: { app: Pick<Application, 'status' | 'unparsed'> }) {
  return (
    <>
      {app.status === '' && (
        <option value="" disabled>
          {app.unparsed?.status ? `Unrecognized: ${app.unparsed.status}` : 'No status'}
        </option>
      )}
      {STATUSES.map((status) => (
        <option key={status}>{status}</option>
      ))}
    </>
  );
}
