import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { toIsoDate } from '../../lib/dates';
import type { Application, ApplicationPatch, Status } from '../../types/application';
import { FieldError } from '../ApplicationFields/FieldError';
import { PositionCombobox } from '../ApplicationFields/PositionCombobox';
import { StatusOptions } from '../ApplicationFields/StatusOptions';
import {
  draftFromApplication,
  useApplicationDraft,
  type DraftApplication,
} from '../ApplicationFields/useApplicationDraft';
import { SaveError } from '../Notice/Notice';

/**
 * Only the fields the user changed, so a save never overwrites cells they
 * didn't touch (the sheet may have changed since it loaded). An emptied
 * optional field is sent as undefined, which clears it.
 */
function changedFields(app: Application, next: DraftApplication): ApplicationPatch {
  const patch: ApplicationPatch = {};
  if (next.dateApplied !== app.dateApplied) patch.dateApplied = next.dateApplied;
  if (next.company !== app.company) patch.company = next.company;
  if (next.position !== app.position) patch.position = next.position;
  if (next.status !== '' && next.status !== app.status) patch.status = next.status;
  if (next.followedUpDate !== app.followedUpDate) patch.followedUpDate = next.followedUpDate;
  if (next.notes !== app.notes) patch.notes = next.notes;
  return patch;
}

export interface EditRowProps {
  app: Application;
  positions: string[];
  today: Date;
  /** Read-only Age cell content (age isn't editable). */
  age: ReactNode;
  /** Persists the changes. Rejects to keep the row open with an error. */
  onSave: (patch: ApplicationPatch) => Promise<void>;
  onCancel: () => void;
}

/** A table row turned into fields. Enter saves (except in Notes); Escape cancels. */
export function EditRow({ app, positions, today, age, onSave, onCancel }: EditRowProps) {
  const baseId = useId();
  const ids = {
    dateApplied: `${baseId}-date`,
    company: `${baseId}-company`,
    position: `${baseId}-position`,
    status: `${baseId}-status`,
    followedUpDate: `${baseId}-followed-up`,
    notes: `${baseId}-notes`,
  };
  const { draft, setField, errors, errorId, errorProps, validate, toApplication } =
    useApplicationDraft(draftFromApplication(app), { ids, errorIdPrefix: baseId, positions });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ error: unknown } | null>(null);

  // Focus the first field when the row opens.
  const firstFieldId = ids.dateApplied;
  useEffect(() => {
    document.getElementById(firstFieldId)?.focus();
  }, [firstFieldId]);

  async function save() {
    if (saving || !validate()) return;
    setSaving(true);
    try {
      await onSave(changedFields(app, toApplication()));
    } catch (error) {
      setSaveError({ error });
      setSaving(false);
    }
  }

  function changeStatus(status: Status) {
    setField('status', status);
    if (status === 'Followed Up' && !draft.followedUpDate) {
      setField('followedUpDate', toIsoDate(today));
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    const target = event.target as HTMLElement;
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Enter' && !['TEXTAREA', 'BUTTON'].includes(target.tagName)) {
      event.preventDefault();
      void save();
    }
  }

  return (
    // Keyboard shortcuts are delegated from the fields to the row.
    <tr className="applications-table__row" data-editing onKeyDown={handleKeyDown}>
      <td>
        <label htmlFor={ids.dateApplied} className="sr-only">
          Date applied
        </label>
        <input
          id={ids.dateApplied}
          type="date"
          className="applications-table__field"
          required
          value={draft.dateApplied}
          onChange={(event) => setField('dateApplied', event.target.value)}
          {...errorProps('dateApplied')}
        />
        <FieldError id={errorId('dateApplied')} message={errors.dateApplied} />
      </td>
      <td>
        <div className="applications-table__stack">
          <label htmlFor={ids.company} className="sr-only">
            Company
          </label>
          <input
            id={ids.company}
            type="text"
            className="applications-table__field"
            autoComplete="off"
            required
            value={draft.company}
            onChange={(event) => setField('company', event.target.value)}
            {...errorProps('company')}
          />
          <FieldError id={errorId('company')} message={errors.company} />
          <PositionCombobox
            id={ids.position}
            value={draft.position}
            onValueChange={(value) => setField('position', value)}
            positions={positions}
            label="Position"
            labelClassName="sr-only"
            inputClassName="applications-table__field"
            errorProps={errorProps('position')}
            menu="inline"
          />
          <FieldError id={errorId('position')} message={errors.position} />
        </div>
      </td>
      <td>
        <label htmlFor={ids.status} className="sr-only">
          Status
        </label>
        <select
          id={ids.status}
          className="applications-table__select"
          value={draft.status}
          onChange={(event) => changeStatus(event.target.value as Status)}
        >
          <StatusOptions
            app={{ status: draft.status, ...(app.unparsed && { unparsed: app.unparsed }) }}
          />
        </select>
      </td>
      <td className="applications-table__cell applications-table__cell--numeric">{age}</td>
      <td>
        <label htmlFor={ids.followedUpDate} className="sr-only">
          Followed up
        </label>
        <input
          id={ids.followedUpDate}
          type="date"
          className="applications-table__field"
          value={draft.followedUpDate}
          onChange={(event) => setField('followedUpDate', event.target.value)}
        />
      </td>
      <td>
        <label htmlFor={ids.notes} className="sr-only">
          Notes
        </label>
        <textarea
          id={ids.notes}
          className="applications-table__field applications-table__field--notes"
          rows={2}
          value={draft.notes}
          onChange={(event) => setField('notes', event.target.value)}
        />
      </td>
      <td>
        <div className="applications-table__row-actions">
          <button
            type="button"
            className="btn btn--primary applications-table__row-button"
            aria-disabled={saving}
            onClick={() => void save()}
          >
            Save
          </button>
          <button type="button" className="btn applications-table__row-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
        {saveError && (
          <SaveError
            className="applications-table__row-error"
            error={saveError.error}
            fallback="Couldn’t save."
            retrying={saving}
            onRetry={() => void save()}
          />
        )}
      </td>
    </tr>
  );
}
