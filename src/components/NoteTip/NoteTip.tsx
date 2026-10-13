import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

export interface NoteTipProps {
  text: string;
}

/**
 * One line of text, cut off with an ellipsis when it doesn't fit, and the
 * whole text in a tip when it is: on hover with a mouse, on tap with touch
 * or a pen, and on keyboard focus. Escape, a tap elsewhere, or scrolling
 * closes it (WCAG 1.4.13). Text that fits is plain text, with no tab stop.
 * The tip is aria-hidden: screen readers get the whole text from the button.
 * It opens in the top layer (popover), so the table's scroller can't clip it.
 */
export function NoteTip({ text }: NoteTipProps) {
  const lineRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const pointerType = useRef('');
  const [truncated, setTruncated] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});

  // Re-measure whenever the cell (and so the line) changes width.
  useEffect(() => {
    const cell = lineRef.current?.parentElement;
    if (!cell) return;
    const measure = () => {
      const line = lineRef.current;
      if (!line) return;
      // The text's own width: a button's scrollWidth doesn't report overflow.
      const range = document.createRange();
      range.selectNodeContents(line);
      setTruncated(range.getBoundingClientRect().width > line.clientWidth + 0.5);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cell);
    return () => observer.disconnect();
  }, [text]);

  const showing = open && truncated;

  // Above the line, left edges together; below it when there's no room above;
  // pulled in from the window's right edge.
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    const line = lineRef.current;
    if (!bubble || !line) return;
    if (!showing) {
      if (bubble.matches(':popover-open')) bubble.hidePopover();
      return;
    }
    bubble.showPopover();
    const margin = 8;
    const lineBox = line.getBoundingClientRect();
    const { width, height } = bubble.getBoundingClientRect();
    const above = lineBox.top - height - margin / 2;
    setPosition({
      top: above >= margin ? above : lineBox.bottom + margin / 2,
      left: Math.max(margin, Math.min(lineBox.left, window.innerWidth - width - margin)),
    });
  }, [showing]);

  useEffect(() => {
    if (!showing) return;
    const close = () => setOpen(false);
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    function handlePointerDown(event: PointerEvent) {
      if (!lineRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [showing]);

  if (!truncated) {
    return (
      <span
        ref={(node) => {
          lineRef.current = node;
        }}
        className="note-tip"
      >
        {text}
      </span>
    );
  }

  return (
    <>
      <button
        ref={(node) => {
          lineRef.current = node;
        }}
        type="button"
        className="note-tip"
        onPointerDown={(event) => {
          pointerType.current = event.pointerType;
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setOpen(false);
        }}
        // A mouse uses hover; a tap (or Enter / Space) toggles.
        onClick={() => {
          if (pointerType.current !== 'mouse') setOpen((value) => !value);
          pointerType.current = '';
        }}
        // Keyboard focus only: a tap focuses too, and its click toggles.
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
      >
        {text}
      </button>
      <span
        ref={bubbleRef}
        className="tooltip__bubble tooltip__bubble--popover"
        popover="manual"
        style={position}
        aria-hidden="true"
      >
        {text}
      </span>
    </>
  );
}
