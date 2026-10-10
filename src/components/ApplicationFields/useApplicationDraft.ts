import { useState } from 'react';
import {
  canonicalPosition,
  REQUIRED_FIELDS,
  validateRequired,
  type FieldErrors,
  type RequiredField,
} from '../../lib/applicationRules';
import type { Application, NewApplication, Status } from '../../types/application';

/** Editable values for one application. Optional fields are '' when empty. */
export interface ApplicationDraft {
  dateApplied: string;
  company: string;
  position: string;
  status: Status;
  followedUpDate: string;
  notes: string;
}

export function draftFromApplication(app: Application): ApplicationDraft {
  return {
    dateApplied: app.dateApplied,
    company: app.company,
    position: app.position,
    status: app.status,
    followedUpDate: app.followedUpDate ?? '',
    notes: app.notes ?? '',
  };
}

export function emptyDraft(dateApplied: string): ApplicationDraft {
  return {
    dateApplied,
    company: '',
    position: '',
    status: 'Applied',
    followedUpDate: '',
    notes: '',
  };
}

interface Options {
  /** DOM ids of the required fields' inputs, for moving focus to the first invalid one. */
  ids: Record<RequiredField, string>;
  /** Prefix for error message ids (`${errorIdPrefix}-company-error`). */
  errorIdPrefix: string;
  /** Known positions, so a case-insensitive match saves with the existing casing. */
  positions: string[];
}

/**
 * Draft state, validation and error wiring shared by the add form and the
 * table's edit row, so both apply the same rules the same way.
 */
export function useApplicationDraft(
  initial: ApplicationDraft,
  { ids, errorIdPrefix, positions }: Options,
) {
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  function setField<K extends keyof ApplicationDraft>(field: K, value: ApplicationDraft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    if ((REQUIRED_FIELDS as readonly string[]).includes(field)) {
      const key = field as RequiredField;
      setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    }
  }

  const errorId = (field: RequiredField) => `${errorIdPrefix}-${field}-error`;

  /** aria-invalid/aria-describedby for a field, only while it has an error. */
  function errorProps(field: RequiredField): {
    'aria-invalid'?: true;
    'aria-describedby'?: string;
  } {
    return errors[field] ? { 'aria-invalid': true, 'aria-describedby': errorId(field) } : {};
  }

  /** Shows errors and focuses the first invalid field. Returns true when valid. */
  function validate(): boolean {
    const next = validateRequired(draft);
    setErrors(next);
    const firstInvalid = REQUIRED_FIELDS.find((field) => next[field]);
    if (firstInvalid) document.getElementById(ids[firstInvalid])?.focus();
    return !firstInvalid;
  }

  /** Trimmed values ready to save; empty optional fields are left out. */
  function toApplication(): NewApplication {
    const notes = draft.notes.trim();
    return {
      dateApplied: draft.dateApplied,
      company: draft.company.trim(),
      position: canonicalPosition(draft.position, positions),
      status: draft.status,
      ...(draft.followedUpDate && { followedUpDate: draft.followedUpDate }),
      ...(notes && { notes }),
    };
  }

  function reset(next: ApplicationDraft) {
    setDraft(next);
    setErrors({});
  }

  return { draft, setField, errors, errorId, errorProps, validate, toApplication, reset };
}
