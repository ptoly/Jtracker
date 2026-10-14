import { useId, useImperativeHandle, useState, type FormEvent, type Ref } from 'react';
import { distinctPositions } from '../../lib/applicationRules';
import { companyKey, findCompanyMatches, matchSummary } from '../../lib/companyMatch';
import { toIsoDate } from '../../lib/dates';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import type { Application, NewApplication } from '../../types/application';
import { FieldError } from '../ApplicationFields/FieldError';
import { PositionCombobox } from '../ApplicationFields/PositionCombobox';
import { emptyDraft, useApplicationDraft } from '../ApplicationFields/useApplicationDraft';
import { DateInput } from '../DateInput/DateInput';
import { IconButton } from '../IconButton/IconButton';
import { PlusIcon, XCloseIcon } from '../Icons/Icons';
import { SaveError } from '../Notice/Notice';
import { MatchAlert } from './MatchAlert';

/** How long typing pauses before Company is checked against earlier applications. */
const MATCH_DELAY_MS = 250;

/** What a table search that found nothing hands the form: a company, or a known position. */
export type ApplicationPrefill = { company: string } | { position: string };

export interface ApplicationFormHandle {
  /** Fills Company or Position, then focuses the other one. */
  prefill: (fill: ApplicationPrefill) => void;
}

export interface ApplicationFormProps {
  /** Existing applications, for the "applied before" check (and the default position list). */
  applications: Application[];
  /** Position suggestions. Defaults to the positions in `applications`. */
  positions?: string[];
  /** The app's reference date; the Date field defaults to it. */
  today: Date;
  /** Persists the new application. The form resets once this resolves. */
  onAdd: (input: NewApplication) => Promise<unknown>;
  /** Shows a "Manage Positions" button under the Position field. */
  onManagePositions?: () => void;
  ref?: Ref<ApplicationFormHandle>;
}

export function ApplicationForm({
  applications,
  positions: suggestions,
  today,
  onAdd,
  onManagePositions,
  ref,
}: ApplicationFormProps) {
  const baseId = useId();
  const ids = {
    dateApplied: `${baseId}-date`,
    company: `${baseId}-company`,
    position: `${baseId}-position`,
    notes: `${baseId}-notes`,
  };
  const dateHelpId = `${baseId}-date-help`;

  const todayIso = toIsoDate(today);
  const positions = suggestions ?? distinctPositions(applications);
  const { draft, setField, errors, errorId, errorProps, validate, toApplication, reset } =
    useApplicationDraft(emptyDraft(todayIso), { ids, errorIdPrefix: baseId, positions });

  const [submitError, setSubmitError] = useState<{ error: unknown } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The counter keys the message so a repeat ("Added Acme" twice) is still a DOM change and re-announces.
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 });
  const [noteOpen, setNoteOpen] = useState(false);
  // Set by "Add Note", so the textarea takes focus when it appears.
  const [focusNote, setFocusNote] = useState(false);
  // The company key the match alert was dismissed for; typing another brings it back.
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const focusField = (id: string) => document.getElementById(id)?.focus();

  useImperativeHandle(ref, () => ({
    prefill(fill: ApplicationPrefill) {
      if ('company' in fill) {
        setField('company', fill.company);
        focusField(ids.position);
      } else {
        setField('position', fill.position);
        focusField(ids.company);
      }
    },
  }));

  // Matches follow the debounced text, but an emptied field (cleared, or
  // reset after adding) hides them at once.
  const companyQuery = useDebouncedValue(draft.company, MATCH_DELAY_MS);
  const matchKey = companyKey(companyQuery);
  const matches = draft.company.trim() ? findCompanyMatches(applications, companyQuery) : [];
  const showMatches = matches.length > 0 && dismissedKey !== matchKey;

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
    setNoteOpen(false);
    setDismissedKey(null);
    setAnnouncement((prev) => ({ text: `Added ${input.company}`, count: prev.count + 1 }));
    focusField(ids.company);
  }

  const required = (
    <span className="field__required" aria-hidden="true">
      *
    </span>
  );

  const fields = (
    <div className="application-form__fields">
      <div className="field">
        <label htmlFor={ids.company}>Company/Search{required}</label>
        <div className="application-form__company">
          <input
            id={ids.company}
            type="text"
            className="control application-form__company-input"
            autoComplete="off"
            required
            value={draft.company}
            onChange={(event) => setField('company', event.target.value)}
            // Escape clears it: the keyboard's way to the ✕, which Tab skips.
            onKeyDown={(event) => {
              if (event.key === 'Escape' && draft.company) {
                event.preventDefault();
                setField('company', '');
              }
            }}
            {...errorProps('company')}
          />
          {draft.company && (
            <span className="application-form__clear">
              {/* Out of the tab order, so Tab goes straight from Company to Position. */}
              <IconButton
                label="Clear company"
                tooltip="Clear"
                icon={<XCloseIcon />}
                tabIndex={-1}
                onClick={() => {
                  setField('company', '');
                  focusField(ids.company);
                }}
              />
            </span>
          )}
        </div>
        <FieldError id={errorId('company')} message={errors.company} />
      </div>

      {/* Position and Date Applied share a row while there's room; Date drops below when not.
          Tab follows the reading order: Company, Position, Date. */}
      <div className="application-form__row">
        <div className="field">
          <PositionCombobox
            id={ids.position}
            value={draft.position}
            onValueChange={(value) => setField('position', value)}
            positions={positions}
            label={<>Position{required}</>}
            inputClassName="control"
            errorProps={errorProps('position')}
          />
          <FieldError id={errorId('position')} message={errors.position} />
          {onManagePositions && (
            <button
              type="button"
              className="btn btn--link application-form__manage"
              onClick={onManagePositions}
            >
              Manage Positions
            </button>
          )}
        </div>

        <div className="field application-form__date">
          <label htmlFor={ids.dateApplied}>Date Applied{required}</label>
          <DateInput
            id={ids.dateApplied}
            required
            value={draft.dateApplied}
            onChange={(event) => setField('dateApplied', event.target.value)}
            {...errorProps('dateApplied')}
            aria-describedby={
              errors.dateApplied ? `${dateHelpId} ${errorId('dateApplied')}` : dateHelpId
            }
          />
          <div id={dateHelpId} className="field__help">
            Defaults to today
          </div>
          <FieldError id={errorId('dateApplied')} message={errors.dateApplied} />
        </div>
      </div>

      {noteOpen || draft.notes ? (
        <div className="field">
          <label htmlFor={ids.notes}>
            Note <span className="field__optional">(optional)</span>
          </label>
          <textarea
            id={ids.notes}
            ref={(element) => {
              if (element && focusNote) {
                element.focus();
                setFocusNote(false);
              }
            }}
            className="control"
            rows={3}
            value={draft.notes}
            onChange={(event) => setField('notes', event.target.value)}
          />
        </div>
      ) : (
        <button
          type="button"
          className="btn btn--link application-form__note-toggle"
          onClick={() => {
            setNoteOpen(true);
            setFocusNote(true);
          }}
        >
          <PlusIcon />
          Add Note (optional)
        </button>
      )}
    </div>
  );

  return (
    <form className="application-form" noValidate onSubmit={handleSubmit}>
      <div className="card">
        {/* Fields on the left and earlier applications on the right; stacked when narrow. */}
        <div className="card__body application-form__body">
          {fields}
          <div className="application-form__matches">
            {showMatches && (
              <MatchAlert
                matches={matches}
                today={today}
                onDismiss={() => {
                  setDismissedKey(matchKey);
                  focusField(ids.company);
                }}
              />
            )}
          </div>
        </div>
        <div className="card__footer application-form__actions">
          <button type="submit" className="btn btn--primary" aria-disabled={submitting}>
            Add Application
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

      {/* The alert's one-line summary; the alert itself isn't live, so its lines aren't read out on every change. */}
      <div aria-live="polite" className="sr-only">
        {showMatches && matches.map(matchSummary).join('. ')}
      </div>

      <div role="status" className="sr-only">
        {announcement.text && <span key={announcement.count}>{announcement.text}</span>}
      </div>
    </form>
  );
}
