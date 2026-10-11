import type { SelectHTMLAttributes } from 'react';
import { ChevronDownIcon } from '../Icons/Icons';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Classes for the wrapper, e.g. a width from the host component. */
  className?: string;
}

/**
 * A native <select> with the app's control look and its own caret, so the
 * caret sits the same 12px in from the border as text and other control icons.
 * Everything but className goes to the <select>.
 */
export function Select({ className = '', children, ...selectProps }: SelectProps) {
  return (
    <span className={`select ${className}`}>
      <select className="control select__input" {...selectProps}>
        {children}
      </select>
      <ChevronDownIcon className="select__icon" />
    </span>
  );
}
