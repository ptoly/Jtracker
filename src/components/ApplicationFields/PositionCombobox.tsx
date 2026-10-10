import { useCombobox } from 'downshift';
import type { KeyboardEvent, ReactNode } from 'react';
import { normalize } from '../../lib/applicationRules';
import { ChevronDownIcon } from '../Icons/Icons';

export interface PositionComboboxProps {
  /** id of the input; label and menu ids derive from it. */
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Existing positions to suggest; typing anything else is allowed. */
  positions: string[];
  label: ReactNode;
  labelClassName?: string;
  /** Classes for the wrapper (which also contains the label). */
  className?: string;
  inputClassName?: string;
  /** aria-invalid / aria-describedby from the draft's errorProps. */
  errorProps?: { 'aria-invalid'?: true; 'aria-describedby'?: string };
  /**
   * 'overlay' floats the list over the content below; 'inline' pushes it down,
   * for containers that clip overflow (like the scrolling table).
   */
  menu?: 'overlay' | 'inline';
}

/** Free-text position input with suggestions from positions already used. */
export function PositionCombobox({
  id,
  value,
  onValueChange,
  positions,
  label,
  labelClassName = '',
  className = '',
  inputClassName = '',
  errorProps = {},
  menu = 'overlay',
}: PositionComboboxProps) {
  const matches = positions.filter((p) => normalize(p).includes(normalize(value)));

  const {
    isOpen,
    highlightedIndex,
    getLabelProps,
    getInputProps,
    getToggleButtonProps,
    getMenuProps,
    getItemProps,
  } = useCombobox({
    items: matches,
    inputValue: value,
    inputId: id,
    labelId: `${id}-label`,
    menuId: `${id}-menu`,
    toggleButtonId: `${id}-toggle`,
    onInputValueChange: ({ inputValue }) => onValueChange(inputValue),
  });

  // While the list is open, Escape and Enter belong to it: keep them from
  // also cancelling or saving a surrounding edit row or form.
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    if (event.key === 'Escape' || (event.key === 'Enter' && highlightedIndex >= 0)) {
      event.stopPropagation();
    }
  }

  const open = isOpen && matches.length > 0;

  return (
    <div className={`position-combobox ${className}`}>
      {/* Downshift supplies htmlFor/id, linking the label to the input. */}
      <label className={labelClassName} {...getLabelProps()}>
        {label}
      </label>
      <input
        className={`position-combobox__input ${inputClassName}`}
        required
        {...getInputProps({ ...errorProps, onKeyDown: handleKeyDown })}
      />
      {/* Mouse affordance for browsing; keyboard users open the list with the arrow keys. */}
      <button
        type="button"
        className="position-combobox__toggle"
        aria-label="Show positions"
        hidden={positions.length === 0}
        {...getToggleButtonProps()}
      >
        <ChevronDownIcon />
      </button>
      <ul
        className={`position-combobox__menu position-combobox__menu--${menu}${open ? ' position-combobox__menu--open' : ''}`}
        {...getMenuProps()}
      >
        {isOpen &&
          matches.map((item, index) => (
            <li
              key={item}
              className={`position-combobox__option${highlightedIndex === index ? ' position-combobox__option--highlighted' : ''}`}
              {...getItemProps({ item, index })}
            >
              {item}
            </li>
          ))}
      </ul>
    </div>
  );
}
