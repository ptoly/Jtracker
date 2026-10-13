import { useId, useState, type FormEvent } from 'react';
import { normalize } from '../../lib/applicationRules';
import {
  addPosition,
  removedPositions,
  removePosition,
  restorePosition,
  suggestedPositions,
  usageCount,
} from '../../lib/positions';
import type { PositionList } from '../../storage';
import type { Application } from '../../types/application';
import { Dialog } from '../Dialog/Dialog';
import { IconButton } from '../IconButton/IconButton';
import { PencilIcon, TrashIcon } from '../Icons/Icons';
import { SaveError } from '../Notice/Notice';

export interface PositionsDialogProps {
  open: boolean;
  onClose: () => void;
  applications: Application[];
  positions: PositionList;
  /** Applies a change to the stored list (add, remove, restore). */
  onUpdate: (change: (current: PositionList) => PositionList) => Promise<void>;
  /** Renames a position on every application that uses it; resolves to how many changed. */
  onRename: (from: string, to: string) => Promise<number>;
  /** Renaming writes to applications, so it's off when they can't be written. */
  readOnly?: boolean;
}

function pluralizeApplications(count: number): string {
  return `${count} application${count === 1 ? '' : 's'}`;
}

/**
 * Cleans up the position suggestions: find or add, rename (which also renames
 * the applications that use it, merging into an existing name if it matches),
 * remove from suggestions, and restore.
 */
export function PositionsDialog({
  open,
  onClose,
  applications,
  positions,
  onUpdate,
  onRename,
  readOnly = false,
}: PositionsDialogProps) {
  const baseId = useId();
  const queryId = `${baseId}-query`;
  const renameId = `${baseId}-rename`;
  const renameButtonId = (name: string) => `${baseId}-rename-${normalize(name)}`;

  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // The failed action, kept so Retry can run it again.
  const [failure, setFailure] = useState<{ error: unknown; retry: () => void } | null>(null);
  const [announcement, setAnnouncement] = useState({ text: '', count: 0 });

  const suggestions = suggestedPositions(applications, positions);
  const removed = removedPositions(applications, positions);
  const needle = normalize(query);
  const shown = suggestions.filter((name) => normalize(name).includes(needle));
  const exactMatch = suggestions.some((name) => normalize(name) === needle);
  const canAdd = needle !== '' && !exactMatch;

  function announce(text: string) {
    setAnnouncement((prev) => ({ text, count: prev.count + 1 }));
  }

  /** Runs one change; on failure keeps it for Retry. Resolves true on success. */
  async function run(action: () => Promise<string>, focusAfter?: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    try {
      announce(await action());
      setFailure(null);
      if (focusAfter) requestAnimationFrame(() => document.getElementById(focusAfter)?.focus());
      return true;
    } catch (error) {
      setFailure({ error, retry: () => void run(action, focusAfter) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdd) return;
    const name = query.trim();
    void run(async () => {
      await onUpdate((list) => addPosition(list, name));
      setQuery('');
      return `Added ${name}`;
    }, queryId);
  }

  function remove(name: string) {
    void run(async () => {
      await onUpdate((list) => removePosition(list, name));
      return `Removed ${name} from suggestions`;
    }, queryId);
  }

  function restore(name: string) {
    void run(async () => {
      await onUpdate((list) => restorePosition(list, name));
      return `Restored ${name}`;
    }, renameButtonId(name));
  }

  async function saveRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renaming) return;
    const { from } = renaming;
    const to = renaming.to.trim();
    if (!to || to === from) {
      setRenaming(null);
      return;
    }
    const done = await run(async () => {
      const changed = await onRename(from, to);
      return `Renamed ${from} to ${to}, ${pluralizeApplications(changed)} changed`;
    }, renameButtonId(to));
    if (done) setRenaming(null);
  }

  function renameHint(from: string, to: string): string {
    const count = usageCount(applications, from);
    const target = suggestions.find(
      (name) => normalize(name) === normalize(to) && normalize(name) !== normalize(from),
    );
    const changes = count > 0 ? `Changes ${pluralizeApplications(count)} in the sheet.` : '';
    return target ? `${changes} Merges into “${target}”.`.trim() : changes;
  }

  return (
    <Dialog open={open} title="Manage positions" onClose={onClose}>
      <div className="positions-dialog">
        <p className="positions-dialog__intro">
          Suggestions come from your applications. Removing one only hides it here; applications
          keep their text. Renaming changes every application that uses it.
        </p>

        <form className="field positions-dialog__find" onSubmit={add}>
          <label htmlFor={queryId}>Find or add a position</label>
          <div className="positions-dialog__find-row">
            <input
              id={queryId}
              type="text"
              className="control positions-dialog__query"
              autoComplete="off"
              data-autofocus=""
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className="btn" aria-disabled={!canAdd || busy}>
              Add
            </button>
          </div>
        </form>

        {failure && (
          <SaveError
            className="positions-dialog__error"
            error={failure.error}
            fallback="Couldn’t save the change."
            retrying={busy}
            onRetry={failure.retry}
          />
        )}

        <p role="status" className="sr-only">
          {announcement.text && <span key={announcement.count}>{announcement.text}</span>}
        </p>

        {shown.length === 0 ? (
          <p className="positions-dialog__empty">
            {suggestions.length === 0
              ? 'No positions yet.'
              : `No positions match “${query.trim()}”.`}
          </p>
        ) : (
          <ul className="positions-dialog__list" aria-label="Positions">
            {shown.map((name) => {
              const count = usageCount(applications, name);
              if (renaming && normalize(renaming.from) === normalize(name)) {
                const hint = renameHint(name, renaming.to);
                return (
                  <li key={name} className="positions-dialog__item">
                    <form className="positions-dialog__rename" onSubmit={(e) => void saveRename(e)}>
                      <label htmlFor={renameId} className="sr-only">
                        New name for {name}
                      </label>
                      <input
                        id={renameId}
                        type="text"
                        className="control positions-dialog__query"
                        autoComplete="off"
                        // Opened by the Rename button; typing starts right away.
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        value={renaming.to}
                        aria-describedby={hint ? `${renameId}-hint` : undefined}
                        onChange={(event) => setRenaming({ from: name, to: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            // Cancels the rename without closing the dialog.
                            event.preventDefault();
                            setRenaming(null);
                            requestAnimationFrame(() =>
                              document.getElementById(renameButtonId(name))?.focus(),
                            );
                          }
                        }}
                      />
                      <div className="positions-dialog__rename-buttons">
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            setRenaming(null);
                            requestAnimationFrame(() =>
                              document.getElementById(renameButtonId(name))?.focus(),
                            );
                          }}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn btn--primary" aria-disabled={busy}>
                          Save
                        </button>
                      </div>
                      {hint && (
                        <span id={`${renameId}-hint`} className="positions-dialog__hint">
                          {hint}
                        </span>
                      )}
                    </form>
                  </li>
                );
              }
              return (
                <li key={name} className="positions-dialog__item">
                  <span className="item-name positions-dialog__name">{name}</span>
                  <span className="item-meta">
                    {count > 0 ? pluralizeApplications(count) : 'Added'}
                  </span>
                  <span className="positions-dialog__buttons">
                    <IconButton
                      id={renameButtonId(name)}
                      label={`Rename ${name}`}
                      tooltip="Rename"
                      icon={<PencilIcon />}
                      disabled={busy || (readOnly && count > 0)}
                      onClick={() => setRenaming({ from: name, to: name })}
                    />
                    <IconButton
                      label={`Remove ${name} from suggestions`}
                      tooltip="Remove"
                      icon={<TrashIcon />}
                      variant="danger"
                      disabled={busy}
                      onClick={() => remove(name)}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {removed.length > 0 && (
          <details className="positions-dialog__removed">
            <summary className="positions-dialog__summary">
              Removed from suggestions ({removed.length})
            </summary>
            <ul className="positions-dialog__list">
              {removed.map((name) => (
                <li key={name} className="positions-dialog__item">
                  <span className="item-name positions-dialog__name">{name}</span>
                  <span className="item-meta">
                    {pluralizeApplications(usageCount(applications, name))}
                  </span>
                  <span className="positions-dialog__buttons">
                    <button
                      type="button"
                      className="btn"
                      aria-disabled={busy}
                      aria-label={`Restore ${name}`}
                      onClick={() => restore(name)}
                    >
                      Restore
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="dialog__actions positions-dialog__done">
          <button type="button" className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}
