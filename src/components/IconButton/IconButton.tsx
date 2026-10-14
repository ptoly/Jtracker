import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useTooltip } from '../Tooltip/useTooltip';

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
 * Icon-only button with a tooltip (useTooltip: hover, keyboard focus,
 * Escape; WCAG 1.4.13). The tooltip is aria-hidden; screen readers get `label`.
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
  const tip = useTooltip(disabled);

  return (
    // Hover only toggles the tooltip; the keyboard equivalent is the button's focus.
    <span className="tooltip" {...tip.hoverProps}>
      <button
        type="button"
        className={`quiet-button icon-button${variant === 'danger' ? ' icon-button--danger' : ''} ${className}`}
        aria-label={label}
        disabled={disabled}
        onFocus={(event) => {
          tip.onFocus();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          tip.onBlur();
          onBlur?.(event);
        }}
        {...buttonProps}
      >
        {icon}
      </button>
      <span className="tooltip__bubble" data-open={tip.open ? '' : undefined} aria-hidden="true">
        {tooltip}
      </span>
    </span>
  );
}
