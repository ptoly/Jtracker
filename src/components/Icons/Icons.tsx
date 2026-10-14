import type { SVGProps } from 'react';

// Untitled UI-style line icons (20px drawing, 1.67 stroke, currentColor) in a
// 24px box, so an icon is one 24px line tall like control text and sits on
// the 8pt grid. Decorative: the control that holds one supplies the name.
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="-2 -2 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.67"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M13.333 5v-.667c0-.933 0-1.4-.181-1.756a1.667 1.667 0 00-.729-.729c-.356-.181-.823-.181-1.756-.181H9.333c-.933 0-1.4 0-1.756.181a1.667 1.667 0 00-.729.729c-.181.356-.181.823-.181 1.756V5m1.666 4.583v4.167m3.334-4.167v4.167M2.5 5h15m-1.667 0v9.333c0 1.4 0 2.1-.272 2.635a2.5 2.5 0 01-1.093 1.093c-.534.272-1.234.272-2.635.272H8.167c-1.4 0-2.1 0-2.635-.272a2.5 2.5 0 01-1.093-1.093c-.272-.535-.272-1.235-.272-2.635V5" />
    </Icon>
  );
}

export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M2.396 15.098c.038-.344.057-.517.11-.678.046-.143.112-.279.196-.404.093-.14.216-.263.461-.508L14.167 2.5a2.357 2.357 0 013.333 3.333L6.494 16.84c-.245.245-.368.368-.508.461a1.667 1.667 0 01-.404.196c-.161.053-.334.072-.678.11l-2.82.313.312-2.82z" />
    </Icon>
  );
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M17.5 17.5l-3.625-3.625M15.833 9.167a6.667 6.667 0 11-13.333 0 6.667 6.667 0 0113.333 0z" />
    </Icon>
  );
}

export function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 7.5l5 5 5-5" />
    </Icon>
  );
}

export function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M17.5 8.333h-15M13.333 1.667V5M6.667 1.667V5M6.5 18.333h7c1.4 0 2.1 0 2.635-.272a2.5 2.5 0 001.093-1.093c.272-.535.272-1.235.272-2.635v-7c0-1.4 0-2.1-.272-2.635a2.5 2.5 0 00-1.093-1.093c-.535-.272-1.235-.272-2.635-.272h-7c-1.4 0-2.1 0-2.635.272a2.5 2.5 0 00-1.093 1.093C2.5 5.233 2.5 5.933 2.5 7.333v7c0 1.4 0 2.1.272 2.635a2.5 2.5 0 001.093 1.093c.535.272 1.235.272 2.635.272z" />
    </Icon>
  );
}

export function AlertCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10 6.667V10m0 3.333h.008M18.333 10a8.333 8.333 0 11-16.666 0 8.333 8.333 0 0116.666 0z" />
    </Icon>
  );
}

export function XCloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M15 5L5 15M5 5l10 10" />
    </Icon>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10 4.167v11.666M4.167 10h11.666" />
    </Icon>
  );
}

export function DotsVerticalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10 10.833a.833.833 0 100-1.666.833.833 0 000 1.666zM10 5a.833.833 0 100-1.667A.833.833 0 0010 5zm0 11.667a.833.833 0 100-1.667.833.833 0 000 1.667z" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M15.833 10H4.167m0 0L10 15.833M4.167 10L10 4.167" />
    </Icon>
  );
}

export function ArrowUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M10 15.833V4.167m0 0L4.167 10M10 4.167L15.833 10" />
    </Icon>
  );
}

export function ArrowRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4.167 10h11.666m0 0L10 4.167M15.833 10L10 15.833" />
    </Icon>
  );
}
