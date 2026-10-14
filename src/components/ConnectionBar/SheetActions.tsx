import { useId, useState, type FormEvent } from 'react';
import { Dialog } from '../Dialog/Dialog';
import { MoreActions } from '../MoreActions/MoreActions';

export interface SheetActionsProps {
  tab: string;
  onReload: () => void;
  onDisconnect: () => void;
  onTabChange: (tab: string) => void;
}

/**
 * The connected sheet's controls: Reload, and a "More actions" menu
 * (MoreActions) with Sheet settings and Disconnect. Sheet settings opens a
 * dialog, since a menu can't hold a form.
 */
export function SheetActions({ tab, onReload, onDisconnect, onTabChange }: SheetActionsProps) {
  const inputId = `${useId()}-tab`;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tabDraft, setTabDraft] = useState(tab);

  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = tabDraft.trim();
    setSettingsOpen(false);
    if (next && next !== tab) onTabChange(next);
  }

  return (
    <div className="sheet-actions">
      <button type="button" className="btn" onClick={onReload}>
        Reload from sheet
      </button>
      <MoreActions
        items={[
          {
            label: 'Sheet settings…',
            onSelect: () => {
              setTabDraft(tab);
              setSettingsOpen(true);
            },
          },
          { label: 'Disconnect', onSelect: onDisconnect },
        ]}
      />

      <Dialog
        open={settingsOpen}
        title="Sheet settings"
        size="small"
        onClose={() => setSettingsOpen(false)}
      >
        <form className="dialog__form" onSubmit={saveSettings}>
          <div className="field">
            <label htmlFor={inputId}>Sheet tab name</label>
            <input
              id={inputId}
              type="text"
              className="control"
              autoComplete="off"
              spellCheck={false}
              data-autofocus=""
              value={tabDraft}
              onChange={(event) => setTabDraft(event.target.value)}
            />
          </div>
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={() => setSettingsOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              Save
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
