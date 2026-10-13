import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  /** Full accessible name, e.g. "Delete Acme application". */
  label: string;
  /** Short visible tooltip, e.g. "Delete". Should be the start of `label` (WCAG 2.5.3). */
  tooltip: string;
  icon: ReactNode;
  variant?: 'default' | 'danger';
}

/**
 * Icon-only button with a tooltip that meets WCAG 1.4.13: it shows on hover
 * and on keyboard focus, stays while the pointer is over it, and Escape
 * dismisses it. The tooltip is aria-hidden; screen readers get `label`.
 */
export function IconButton({
  label,
  tooltip,
  icon,
  variant = 'default',
  className = '',
  disabled,
  onFocus,
  onBlur,
  ...buttonProps
}: IconButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused) && !dismissed && !disabled;

  // Escape dismisses an open tooltip whether it came from hover or focus,
  // without moving the pointer or focus (WCAG 1.4.13).
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDismissed(true);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    // Hover only toggles the tooltip; the keyboard equivalent is the button's focus.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <span
      className="tooltip"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setDismissed(false);
      }}
    >
      <button
        type="button"
        className={`quiet-button icon-button${variant === 'danger' ? ' icon-button--danger' : ''} ${className}`}
        aria-label={label}
        disabled={disabled}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          setDismissed(false);
          onBlur?.(event);
        }}
        {...buttonProps}
      >
        {icon}
      </button>
      <span className="tooltip__bubble" data-open={open ? '' : undefined} aria-hidden="true">
        {tooltip}
      </span>
    </span>
  );
}
