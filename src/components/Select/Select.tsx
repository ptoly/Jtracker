import type { SelectHTMLAttributes } from 'react';
import { ChevronDownIcon } from '../Icons/Icons';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Classes for the wrapper, e.g. a width from the host component. */
  className?: string;
  /**
   * A coloured dot before the value. Decorative: the value (or text near the
   * select) must say the same thing in words.
   */
  dot?: 'warning' | 'success' | undefined;
}

/**
 * A native <select> with the app's control look and its own caret, so the
 * caret sits the same 12px in from the border as text and other control icons.
 * Everything but className and dot goes to the <select>.
 */
export function Select({ className = '', dot, children, ...selectProps }: SelectProps) {
  return (
    <span className={`select${dot ? ' select--dot' : ''} ${className}`}>
      {dot && <span className={`select__dot select__dot--${dot}`} aria-hidden="true" />}
      <select className="control select__input" {...selectProps}>
        {children}
      </select>
      <ChevronDownIcon className="select__icon" />
    </span>
  );
}
