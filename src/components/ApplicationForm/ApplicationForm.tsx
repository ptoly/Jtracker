import { useCombobox } from 'downshift';
import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { toIsoDate } from '../../lib/dates';
import type { Application, NewApplication } from '../../types/application';
import { DateText } from '../DateText/DateText';

type Field = 'date' | 'company' | 'position';
type Errors = { [K in Field]?: string | undefined };

/** Validation order, which is also the order focus checks for the first invalid field. */
const FIELD_ORDER: Field[] = ['date', 'company', 'position'];

export interface ApplicationFormProps {
  /** Existing applications: the source of the position list and the duplicate check. */
  applications: Application[];
  /** The app's reference date; the Date field defaults to it. */
  today: Date;
  /** Persists the new application. The form resets once this resolves. */
  onAdd: (input: NewApplication) => Promise<unknown>;
}

const normalize = (value: string) => value.trim().toLowerCase();

/** Distinct positions, first-seen casing wins, sorted A→Z. */
function distinctPositions(applications: Application[]): string[] {
  const byKey = new Map<string, string>();
  for (const { position } of applications) {
    const key = normalize(position);
    if (key && !byKey.has(key)) byKey.set(key, position.trim());
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function validate(date: string, company: string, position: string): Errors {
  const errors: Errors = {};
  if (!date) errors.date = 'Enter the date you applied.';
  if (!company.trim()) errors.company = 'Enter a company.';
  if (!position.trim()) errors.position = 'Enter a position.';
  return errors;
}

export function ApplicationForm({ applications, today, onAdd }: ApplicationFormProps) {
  const baseId = useId();
  const ids = {
    date: `${baseId}-date`,
    company: `${baseId}-company`,
    position: `${baseId}-position`,
    positionLabel: `${baseId}-position-label`,
    positionMenu: `${baseId}-position-menu`,
    notes: `${baseId}-notes`,
    error: (field: Field) => `${baseId}-${field}-error`,
  };

  const todayIso = toIsoDate(today);
  const [date, setDate] = useState(todayIso);
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // The counter keys the message so a repeat ("Added Acme" twice) is still a DOM change and re-announces.
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 });

  const positions = distinctPositions(applications);
  const positionMatches = positions.filter((p) => normalize(p).includes(normalize(position)));

  const {
    isOpen,
    highlightedIndex,
    getLabelProps,
    getInputProps,
    getToggleButtonProps,
    getMenuProps,
    getItemProps,
  } = useCombobox({
    items: positionMatches,
    inputValue: position,
    inputId: ids.position,
    labelId: ids.positionLabel,
    menuId: ids.positionMenu,
    onInputValueChange: ({ inputValue }) => {
      setPosition(inputValue);
      clearError('position');
    },
  });

  const duplicate =
    company.trim() && position.trim()
      ? applications
          .filter(
            (app) =>
              normalize(app.company) === normalize(company) &&
              normalize(app.position) === normalize(position),
          )
          .sort((a, b) => b.dateApplied.localeCompare(a.dateApplied))[0]
      : undefined;

  function clearError(field: Field) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  /** aria-describedby/aria-invalid for a field, only while it has an error. */
  function errorProps(field: Field): { 'aria-invalid'?: true; 'aria-describedby'?: string } {
    return errors[field]
      ? { 'aria-invalid': true as const, 'aria-describedby': ids.error(field) }
      : {};
  }

  function errorMessage(field: Field) {
    const message = errors[field];
    return message ? (
      <span id={ids.error(field)} className="application-form__error">
        {message}
      </span>
    ) : null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validate(date, company, position);
    setErrors(nextErrors);
    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(ids[firstInvalid])?.focus();
      return;
    }

    // Reuse the existing casing when the typed position matches one case-insensitively.
    const typed = position.trim();
    const canonicalPosition = positions.find((p) => normalize(p) === normalize(typed)) ?? typed;
    const trimmedCompany = company.trim();
    const trimmedNotes = notes.trim();

    setSubmitting(true);
    setSubmitError('');
    try {
      await onAdd({
        dateApplied: date,
        company: trimmedCompany,
        position: canonicalPosition,
        status: 'Applied',
        ...(trimmedNotes && { notes: trimmedNotes }),
      });
    } catch {
      setSubmitError('Couldn’t add the application. Try again.');
      return;
    } finally {
      setSubmitting(false);
    }

    setDate(todayIso);
    setCompany('');
    setPosition('');
    setNotes('');
    setErrors({});
    setAnnouncement((prev) => ({ text: `Added ${trimmedCompany}`, count: prev.count + 1 }));
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
    <form className="application-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <div className="card">
        <div className="card__body application-form__fields">
          <div className="application-form__field application-form__field--date">
            <label htmlFor={ids.date} className="application-form__label">
              Date{required}
            </label>
            <input
              id={ids.date}
              type="date"
              className="application-form__input"
              required
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                clearError('date');
              }}
              {...errorProps('date')}
            />
            {errorMessage('date')}
          </div>

          <div className="application-form__field">
            <label htmlFor={ids.company} className="application-form__label">
              Company{required}
            </label>
            <input
              id={ids.company}
              type="text"
              className="application-form__input"
              autoComplete="off"
              required
              value={company}
              onChange={(event) => {
                setCompany(event.target.value);
                clearError('company');
              }}
              {...errorProps('company')}
            />
            {errorMessage('company')}
          </div>

          <div className="application-form__field">
            {/* Downshift supplies htmlFor/id, linking the label to the input. */}
            <label className="application-form__label" {...getLabelProps()}>
              Position{required}
            </label>
            <div className="application-form__combobox">
              <input
                className="application-form__input application-form__input--combobox"
                required
                {...getInputProps(errorProps('position'))}
              />
              {/* Mouse affordance for browsing; keyboard users open the list with the arrow keys. */}
              <button
                type="button"
                className="application-form__toggle"
                aria-label="Show positions"
                hidden={positions.length === 0}
                {...getToggleButtonProps()}
              >
                <svg
                  viewBox="0 0 20 20"
                  width="20"
                  height="20"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M5 7.5l5 5 5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.67"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <ul
                className={`application-form__menu${isOpen && positionMatches.length > 0 ? ' application-form__menu--open' : ''}`}
                {...getMenuProps()}
              >
                {isOpen &&
                  positionMatches.map((item, index) => (
                    <li
                      key={item}
                      className={`application-form__option${highlightedIndex === index ? ' application-form__option--highlighted' : ''}`}
                      {...getItemProps({ item, index })}
                    >
                      {item}
                    </li>
                  ))}
              </ul>
            </div>
            {errorMessage('position')}
          </div>

          <div className="application-form__field">
            <label htmlFor={ids.notes} className="application-form__label">
              Notes <span className="application-form__optional">(optional)</span>
            </label>
            <textarea
              id={ids.notes}
              className="application-form__input application-form__textarea"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
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
        <div role="alert" className="application-form__error">
          {submitError}
        </div>
      )}

      <div aria-live="polite" className="application-form__warning-region">
        {duplicate && (
          <div className="application-form__warning">
            You applied to {duplicate.company} for {duplicate.position} on{' '}
            <DateText iso={duplicate.dateApplied} />.
          </div>
        )}
      </div>

      <div role="status" className="sr-only">
        {announcement.text && <span key={announcement.count}>{announcement.text}</span>}
      </div>
    </form>
  );
}
