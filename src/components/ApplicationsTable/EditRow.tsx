import {
  useEffect,
  useId,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
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
import { DateInput } from '../DateInput/DateInput';
import { Dialog } from '../Dialog/Dialog';
import { IconButton } from '../IconButton/IconButton';
import { PencilIcon } from '../Icons/Icons';
import { NoteTip } from '../NoteTip/NoteTip';
import { SaveError } from '../Notice/Notice';
import { Select } from '../Select/Select';

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
  /** 'row' for the table (labels hidden; the column headers name the fields), 'card' for narrow screens. */
  layout?: 'row' | 'card';
}

/**
 * A table row (or, on narrow screens, a card) turned into fields. Enter saves
 * (except in Notes); Escape cancels. In the table, Notes is the note's first
 * line and a pencil that opens it in a dialog; Done there updates the row,
 * and the row's Save saves it.
 */
export function EditRow({
  app,
  positions,
  today,
  age,
  onSave,
  onCancel,
  layout = 'row',
}: EditRowProps) {
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
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');

  // Focus the first field when the row opens: the first column, or the
  // card's first field.
  const firstFieldId = layout === 'row' ? ids.dateApplied : ids.company;
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

  function openNotes() {
    setNotesDraft(draft.notes);
    setNotesOpen(true);
  }

  function applyNotes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setField('notes', notesDraft);
    setNotesOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    // The notes dialog handles its own keys: Escape closes only the dialog.
    if (target.closest('dialog')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Enter' && !['TEXTAREA', 'BUTTON'].includes(target.tagName)) {
      event.preventDefault();
      void save();
    }
  }

  // In the table the column headers name the fields; a card shows its labels.
  const labelClass = layout === 'row' ? 'sr-only' : undefined;

  const dateFields = (
    <>
      <div className="field">
        <label htmlFor={ids.dateApplied} className={labelClass}>
          Date applied
        </label>
        <DateInput
          id={ids.dateApplied}
          required
          value={draft.dateApplied}
          onChange={(event) => setField('dateApplied', event.target.value)}
          {...errorProps('dateApplied')}
        />
        <FieldError id={errorId('dateApplied')} message={errors.dateApplied} />
      </div>
      <div className="field">
        <label htmlFor={ids.followedUpDate} className={labelClass}>
          Followed up
        </label>
        <DateInput
          id={ids.followedUpDate}
          value={draft.followedUpDate}
          onChange={(event) => setField('followedUpDate', event.target.value)}
        />
      </div>
    </>
  );

  const companyFields = (
    <>
      <div className="field">
        <label htmlFor={ids.company} className={labelClass}>
          Company
        </label>
        <input
          id={ids.company}
          type="text"
          className="control"
          autoComplete="off"
          required
          value={draft.company}
          onChange={(event) => setField('company', event.target.value)}
          {...errorProps('company')}
        />
        <FieldError id={errorId('company')} message={errors.company} />
      </div>
      <div className="field">
        <PositionCombobox
          id={ids.position}
          value={draft.position}
          onValueChange={(value) => setField('position', value)}
          positions={positions}
          label="Position"
          {...(labelClass && { labelClassName: labelClass })}
          inputClassName="control"
          errorProps={errorProps('position')}
          menu="inline"
        />
        <FieldError id={errorId('position')} message={errors.position} />
      </div>
    </>
  );

  const statusField = (
    <div className="field">
      <label htmlFor={ids.status} className={labelClass}>
        Status
      </label>
      <Select
        id={ids.status}
        value={draft.status}
        onChange={(event) => changeStatus(event.target.value as Status)}
      >
        <StatusOptions
          app={{ status: draft.status, ...(app.unparsed && { unparsed: app.unparsed }) }}
        />
      </Select>
    </div>
  );

  const notesField = (
    <div className="field">
      <label htmlFor={ids.notes} className={labelClass}>
        Notes
      </label>
      <textarea
        id={ids.notes}
        className="control applications-table__notes-field"
        rows={2}
        value={draft.notes}
        onChange={(event) => setField('notes', event.target.value)}
      />
    </div>
  );

  const notesButton = (
    <div className="applications-table__notes-edit">
      {draft.notes && <NoteTip text={draft.notes} />}
      <IconButton
        label="Edit notes"
        tooltip="Edit notes"
        icon={<PencilIcon />}
        onClick={openNotes}
      />
      <Dialog
        open={notesOpen}
        title={`Notes for ${draft.company || app.company}`}
        onClose={() => setNotesOpen(false)}
      >
        <form className="dialog__form" onSubmit={applyNotes}>
          <div className="field">
            <label htmlFor={ids.notes} className="sr-only">
              Notes
            </label>
            <textarea
              id={ids.notes}
              className="control"
              rows={8}
              data-autofocus=""
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
            />
          </div>
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => setNotesOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              Done
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );

  const actions = (
    <>
      <div className="applications-table__row-actions">
        <button
          type="button"
          className="btn btn--primary btn--compact"
          aria-disabled={saving}
          onClick={() => void save()}
        >
          Save
        </button>
        <button type="button" className="btn btn--compact" onClick={onCancel}>
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
    </>
  );

  if (layout === 'card') {
    return (
      // Keyboard shortcuts are delegated from the fields to the card.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
      <li className="applications-table__card" data-editing onKeyDown={handleKeyDown}>
        <div className="applications-table__stack">{companyFields}</div>
        {statusField}
        <div className="applications-table__stack">{dateFields}</div>
        {notesField}
        <div>{actions}</div>
      </li>
    );
  }

  return (
    // Keyboard shortcuts are delegated from the fields to the row.
    <tr className="applications-table__row" data-editing onKeyDown={handleKeyDown}>
      <td>
        <div className="applications-table__stack">{dateFields}</div>
      </td>
      <td>
        <div className="applications-table__stack">{companyFields}</div>
      </td>
      <td>{statusField}</td>
      <td className="applications-table__cell applications-table__cell--numeric">{age}</td>
      <td>{notesButton}</td>
      <td>{actions}</td>
    </tr>
  );
}
