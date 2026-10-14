import { useEffect, useState } from 'react';
import { IconButton } from '../IconButton/IconButton';
import { ArrowUpIcon } from '../Icons/Icons';

export interface ScrollTopProps {
  /** id of the element that takes focus at the top (focusable from script: tabIndex -1). */
  targetId: string;
}

/**
 * A "Back to top" button in the window's bottom right corner, once the page
 * has scrolled more than a screen down. It scrolls to the top (smoothly,
 * unless reduced motion is on) and moves focus there, so the keyboard
 * carries on from the top too.
 */
export function ScrollTop({ targetId }: ScrollTopProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const update = () => setShown(window.scrollY > window.innerHeight);
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  if (!shown) return null;

  return (
    <div className="scroll-top">
      <IconButton
        label="Back to top"
        tooltip="Back to top"
        icon={<ArrowUpIcon />}
        className="scroll-top__button"
        onClick={() => {
          const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
          document.getElementById(targetId)?.focus({ preventScroll: true });
        }}
      />
    </div>
  );
}
