import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { distinctPositions, findDuplicate } from '../../lib/applicationRules';
import { toIsoDate } from '../../lib/dates';
import type { Application, NewApplication } from '../../types/application';
import { FieldError } from '../ApplicationFields/FieldError';
import { PositionCombobox } from '../ApplicationFields/PositionCombobox';
import { emptyDraft, useApplicationDraft } from '../ApplicationFields/useApplicationDraft';
import { DateText } from '../DateText/DateText';
import { SaveError } from '../Notice/Notice';

export interface ApplicationFormProps {
  /** Existing applications: the source of the position list and the duplicate check. */
  applications: Application[];
  /** The app's reference date; the Date field defaults to it. */
  today: Date;
  /** Persists the new application. The form resets once this resolves. */
  onAdd: (input: NewApplication) => Promise<unknown>;
}

export function ApplicationForm({ applications, today, onAdd }: ApplicationFormProps) {
  const baseId = useId();
  const ids = {
    dateApplied: `${baseId}-date`,
    company: `${baseId}-company`,
    position: `${baseId}-position`,
    notes: `${baseId}-notes`,
  };

  const todayIso = toIsoDate(today);
  const positions = distinctPositions(applications);
  const { draft, setField, errors, errorId, errorProps, validate, toApplication, reset } =
    useApplicationDraft(emptyDraft(todayIso), { ids, errorIdPrefix: baseId, positions });

  const [submitError, setSubmitError] = useState<{ error: unknown } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The counter keys the message so a repeat ("Added Acme" twice) is still a DOM change and re-announces.
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 });

  const duplicate = findDuplicate(applications, draft.company, draft.position);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void add();
  }

  /** Submit and Retry both land here. On failure the draft stays as typed. */
  async function add() {
    if (submitting || !validate()) return;

    // New applications always start as Applied.
    const input: NewApplication = { ...toApplication(), status: 'Applied' };
    setSubmitting(true);
    try {
      await onAdd(input);
    } catch (error) {
      setSubmitError({ error });
      return;
    } finally {
      setSubmitting(false);
    }

    setSubmitError(null);
    reset(emptyDraft(todayIso));
    setAnnouncement((prev) => ({ text: `Added ${input.company}`, count: prev.count + 1 }));
    document.getElementById(ids.company)?.focus();
  }

  function handleNotesKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const required = (
    <span className="application-form__required" aria-hidden="true">
      *
    </span>
  );

  return (
    <form className="application-form" noValidate onSubmit={handleSubmit}>
      <div className="card">
        <div className="card__body application-form__fields">
          <div className="application-form__field application-form__field--date">
            <label htmlFor={ids.dateApplied} className="application-form__label">
              Date{required}
            </label>
            <input
              id={ids.dateApplied}
              type="date"
              className="control application-form__input"
              required
              value={draft.dateApplied}
              onChange={(event) => setField('dateApplied', event.target.value)}
              {...errorProps('dateApplied')}
            />
            <FieldError id={errorId('dateApplied')} message={errors.dateApplied} />
          </div>

          <div className="application-form__field">
            <div className="application-form__inline">
              <label htmlFor={ids.company} className="application-form__inline-label">
                Company{required}
              </label>
              <input
                id={ids.company}
                type="text"
                className="application-form__inline-input"
                autoComplete="off"
                required
                value={draft.company}
                onChange={(event) => setField('company', event.target.value)}
                {...errorProps('company')}
              />
            </div>
            <FieldError id={errorId('company')} message={errors.company} />
          </div>

          <div className="application-form__field">
            <PositionCombobox
              id={ids.position}
              value={draft.position}
              onValueChange={(value) => setField('position', value)}
              positions={positions}
              label={<>Position{required}</>}
              className="application-form__inline"
              labelClassName="application-form__inline-label"
              inputClassName="application-form__inline-input"
              errorProps={errorProps('position')}
            />
            <FieldError id={errorId('position')} message={errors.position} />
          </div>

          <div className="application-form__field application-form__field--notes">
            <label htmlFor={ids.notes} className="application-form__label">
              Notes <span className="application-form__optional">(optional)</span>
            </label>
            <textarea
              id={ids.notes}
              className="control application-form__input"
              rows={3}
              value={draft.notes}
              onChange={(event) => setField('notes', event.target.value)}
              onKeyDown={handleNotesKeyDown}
            />
          </div>
        </div>

        <div className="card__footer application-form__actions">
          <span className="application-form__hint">⌘/Ctrl + Enter in Notes also adds</span>
          <button type="submit" className="btn btn--primary" aria-disabled={submitting}>
            Add application
          </button>
        </div>
      </div>

      {submitError && (
        <SaveError
          className="application-form__error"
          error={submitError.error}
          fallback="Couldn’t add the application."
          retrying={submitting}
          onRetry={() => void add()}
        />
      )}

      <div aria-live="polite" className="application-form__warning-region">
        {duplicate && (
          <div className="application-form__warning">
            You applied to {duplicate.company} for {duplicate.position}
            {duplicate.dateApplied && (
              <>
                {' '}
                on <DateText iso={duplicate.dateApplied} />
              </>
            )}
            .
          </div>
        )}
      </div>

      <div role="status" className="sr-only">
        {announcement.text && <span key={announcement.count}>{announcement.text}</span>}
      </div>
    </form>
  );
}
