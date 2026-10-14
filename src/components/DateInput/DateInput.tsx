import { useRef, type InputHTMLAttributes } from 'react';
import { CalendarIcon } from '../Icons/Icons';

export interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Classes for the wrapper, e.g. a width from the host component. */
  className?: string;
}

/**
 * A native date field with the app's control look and its own calendar icon
 * in place of the browser's, which is a tab stop in Chrome. The icon opens
 * the picker for a mouse or touch; from the keyboard the date is typed into
 * the field (or Alt+↓ opens the picker). Firefox keeps its own button.
 * Everything but className goes to the <input>.
 */
export function DateInput({ className = '', onKeyDown, ...inputProps }: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input || input.disabled || input.readOnly) return;
    input.focus();
    try {
      input.showPicker();
    } catch {
      // No picker here (or not allowed right now): the field still takes typing.
    }
  }

  return (
    <span className={`date-input ${className}`}>
      <input
        ref={inputRef}
        type="date"
        className="control date-input__input"
        onKeyDown={(event) => {
          if (event.altKey && event.key === 'ArrowDown') {
            event.preventDefault();
            openPicker();
          }
          onKeyDown?.(event);
        }}
        {...inputProps}
      />
      {/* A pointer shortcut only; the field itself is the keyboard's way in. */}
      <span className="date-input__icon" aria-hidden="true" onClick={openPicker}>
        <CalendarIcon />
      </span>
    </span>
  );
}
