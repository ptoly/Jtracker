import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { IconButton } from '../IconButton/IconButton';
import { DotsVerticalIcon } from '../Icons/Icons';

export interface SheetActionsProps {
  tab: string;
  onReload: () => void;
  onDisconnect: () => void;
  onTabChange: (tab: string) => void;
}

/**
 * The connected sheet's controls: Reload, Disconnect, and a "more" menu that
 * holds the less common settings (the sheet tab name). The menu is a
 * disclosure: a button that shows a panel of ordinary buttons and fields.
 */
export function SheetActions({ tab, onReload, onDisconnect, onTabChange }: SheetActionsProps) {
  const baseId = useId();
  const toggleId = `${baseId}-toggle`;
  const panelId = `${baseId}-panel`;
  const inputId = `${baseId}-tab`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [editingTab, setEditingTab] = useState(false);
  const [tabDraft, setTabDraft] = useState(tab);

  function close({ returnFocus }: { returnFocus: boolean }) {
    setOpen(false);
    setEditingTab(false);
    setTabDraft(tab);
    if (returnFocus) document.getElementById(toggleId)?.focus();
  }

  // A click anywhere else closes the menu, leaving focus where the click put it.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setEditingTab(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (editingTab) document.getElementById(inputId)?.focus();
  }, [editingTab, inputId]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      close({ returnFocus: true });
    }
  }

  function saveTab(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = tabDraft.trim();
    if (next && next !== tab) onTabChange(next);
    close({ returnFocus: true });
  }

  return (
    // Escape from anywhere inside the menu closes it; the keys belong to its controls.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="sheet-actions" ref={rootRef} onKeyDown={handleKeyDown}>
      <button type="button" className="btn" onClick={onReload}>
        Reload from sheet
      </button>
      <button type="button" className="btn" onClick={onDisconnect}>
        Disconnect
      </button>
      <div className="sheet-actions__menu">
        <IconButton
          id={toggleId}
          label="More sheet options"
          tooltip="More"
          icon={<DotsVerticalIcon />}
          className="sheet-actions__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => (open ? close({ returnFocus: false }) : setOpen(true))}
        />
        <div id={panelId} className="sheet-actions__panel" hidden={!open}>
          {editingTab ? (
            <form className="sheet-actions__form" onSubmit={saveTab}>
              <label htmlFor={inputId} className="sheet-actions__label">
                Sheet tab name
              </label>
              <input
                id={inputId}
                type="text"
                className="sheet-actions__input"
                autoComplete="off"
                spellCheck={false}
                value={tabDraft}
                onChange={(event) => setTabDraft(event.target.value)}
              />
              <div className="sheet-actions__form-buttons">
                <button type="button" className="btn" onClick={() => close({ returnFocus: true })}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary">
                  Save tab
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="sheet-actions__item"
              onClick={() => setEditingTab(true)}
            >
              Change sheet tab
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
