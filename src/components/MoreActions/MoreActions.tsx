import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { IconButton } from '../IconButton/IconButton';
import { DotsVerticalIcon } from '../Icons/Icons';

export interface MoreAction {
  label: string;
  onSelect: () => void;
}

export interface MoreActionsProps {
  items: MoreAction[];
  /** The ⋮ button's name and tooltip. */
  label?: string;
}

/**
 * A ⋮ "More actions" button and its menu, following the WAI-ARIA menu button
 * pattern: Enter, Space or ↓ opens it on the first item, ↑ on the last;
 * arrows move (and wrap), Home/End jump, a letter jumps to the next item
 * starting with it; Escape closes it and returns focus to the button; Tab or
 * a click elsewhere closes it. Choosing an item closes the menu and returns
 * focus to the button first, so a dialog the item opens hands focus back there.
 */
export function MoreActions({ items, label = 'More actions' }: MoreActionsProps) {
  const baseId = useId();
  const toggleId = `${baseId}-toggle`;
  const menuId = `${baseId}-menu`;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Which item to focus once the menu has rendered open.
  const [focusOnOpen, setFocusOnOpen] = useState<'first' | 'last'>('first');

  const menuItems = () => [
    ...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
  ];
  const toggle = () => document.getElementById(toggleId);

  function openMenu(focus: 'first' | 'last') {
    setFocusOnOpen(focus);
    setOpen(true);
  }

  function closeMenu({ returnFocus }: { returnFocus: boolean }) {
    setOpen(false);
    if (returnFocus) toggle()?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const list = menuItems();
    (focusOnOpen === 'first' ? list[0] : list[list.length - 1])?.focus();
  }, [open, focusOnOpen]);

  // A click anywhere else closes the menu, leaving focus where the click put it.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function handleToggleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = menuItems();
    const current = list.indexOf(document.activeElement as HTMLElement);
    const focusAt = (index: number) => list[(index + list.length) % list.length]?.focus();

    switch (event.key) {
      case 'ArrowDown':
        focusAt(current + 1);
        break;
      case 'ArrowUp':
        focusAt(current - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(list.length - 1);
        break;
      case 'Escape':
        closeMenu({ returnFocus: true });
        break;
      case 'Tab':
        // Focus moves on to the next control as usual; the menu just closes.
        setOpen(false);
        return;
      default: {
        // Type-ahead: the next item starting with the typed letter.
        if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return;
        const letter = event.key.toLowerCase();
        const next = [...list.slice(current + 1), ...list.slice(0, current + 1)].find((item) =>
          item.textContent?.trim().toLowerCase().startsWith(letter),
        );
        if (!next) return;
        next.focus();
      }
    }
    event.preventDefault();
    // Escape is the menu's; it mustn't also close a dialog the page is in.
    event.stopPropagation();
  }

  return (
    <div className="more-actions" ref={rootRef}>
      <IconButton
        id={toggleId}
        label={label}
        tooltip={label}
        icon={<DotsVerticalIcon />}
        className="more-actions__toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onKeyDown={handleToggleKeyDown}
        onClick={() => (open ? closeMenu({ returnFocus: false }) : openMenu('first'))}
      />
      {/* Keys go to the focused item; the menu handles them for all of its items. In the
          menu button pattern focus sits on the items (roving), never on the menu itself. */}
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-labelledby={toggleId}
        className="menu more-actions__list"
        hidden={!open}
        onKeyDown={handleMenuKeyDown}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="menu__item"
            onClick={() => {
              closeMenu({ returnFocus: true });
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
