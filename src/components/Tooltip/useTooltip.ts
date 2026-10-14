import { useEffect, useState } from 'react';

/**
 * Open state for a tooltip that meets WCAG 1.4.13: it shows on hover and on
 * keyboard focus, stays while the pointer is over it, and Escape dismisses
 * it without moving the pointer or focus. Spread `hoverProps` on the
 * .tooltip wrapper and call onFocus / onBlur from the trigger; the bubble
 * shows while `open` (data-open).
 */
export function useTooltip(disabled = false) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused) && !dismissed && !disabled;

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDismissed(true);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return {
    open,
    hoverProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => {
        setHovered(false);
        setDismissed(false);
      },
    },
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      setDismissed(false);
    },
  };
}
