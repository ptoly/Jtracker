import type { ReactNode } from 'react';
import { useTooltip } from '../Tooltip/useTooltip';

export interface IconLinkProps {
  href: string;
  /** Full accessible name, e.g. "Help". "(opens in a new tab)" is added for screen readers. */
  label: string;
  /** Short visible tooltip, e.g. "Help". Should be the start of `label` (WCAG 2.5.3). */
  tooltip: string;
  icon: ReactNode;
  className?: string;
  /** below: for a link at the top of the page, where a tooltip above would be cut off. */
  tooltipPlacement?: 'above' | 'below';
}

/**
 * IconButton's look and tooltip for a link that opens in a new tab (the
 * header's Help). Screen readers hear that it opens a new tab; the tooltip
 * stays short.
 */
export function IconLink({
  href,
  label,
  tooltip,
  icon,
  className = '',
  tooltipPlacement = 'above',
}: IconLinkProps) {
  const tip = useTooltip();

  return (
    <span className="tooltip" {...tip.hoverProps}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={`quiet-button icon-button ${className}`}
        aria-label={`${label} (opens in a new tab)`}
        onFocus={tip.onFocus}
        onBlur={tip.onBlur}
      >
        {icon}
      </a>
      <span
        className={`tooltip__bubble${tooltipPlacement === 'below' ? ' tooltip__bubble--below' : ''}`}
        data-open={tip.open ? '' : undefined}
        aria-hidden="true"
      >
        {tooltip}
      </span>
    </span>
  );
}
