import type { NewApplication, Status } from '../types/application';

/** ISO date `n` days before `today`, so sample ages stay realistic whenever the app runs. */
function daysAgo(n: number, today: Date): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// [company, position, status, appliedDaysAgo, followedUpDaysAgo?, notes?]
type Row = [string, string, Status, number, (number | undefined)?, string?];

// All companies are fictional.
const ROWS: Row[] = [
  ['Quillfeather Systems', 'Frontend Engineer', 'Applied', 2],
  ['Marrowbend Analytics', 'Data Visualization Developer', 'Applied', 5],
  ['Tinderleaf Co.', 'UI Engineer', 'Applied', 9],
  [
    'Copperwick Labs',
    'Senior React Developer',
    'Applied',
    12,
    undefined,
    'Referral from a former colleague.',
  ],
  ['Hollowmere Health', 'Accessibility Engineer', 'Applied', 15],
  ['Saltgrass Logistics', 'Full Stack Developer', 'Applied', 21],
  ['Brindlefox Games', 'Web Tools Engineer', 'Applied', 33, undefined, 'Posting may be stale.'],
  ['Larkspur Ledger', 'Frontend Developer', 'Applied', 1],
  ['Ninefold Robotics', 'Design Systems Engineer', 'Applied', 7],
  ['Oxbow & Finch', 'JavaScript Engineer', 'Applied', 18],
  ['Pebblecrest Media', 'Senior Frontend Engineer', 'Followed Up', 20, 8],
  [
    'Quarry Lane Software',
    'UI Developer',
    'Followed Up',
    25,
    12,
    'Emailed the recruiter directly.',
  ],
  ['Rookwood Insurance', 'Web Developer', 'Followed Up', 30, 15],
  ['Thistledown Finance', 'React Engineer', 'Followed Up', 16, 4],
  ['Umberline Energy', 'Frontend Platform Engineer', 'Followed Up', 40, 22],
  ['Velvetmoss Studio', 'Creative Developer', 'Interviewed', 19, 9, 'Second round scheduled.'],
  ['Wrenfield Bank', 'Staff Frontend Engineer', 'Interviewed', 27, 14],
  ['Yarrow Point Labs', 'TypeScript Developer', 'Interviewed', 11],
  ['Zephyrine Travel', 'Frontend Engineer II', 'Interviewed', 35, 24, 'Take-home submitted.'],
  ['Ashgrove Learning', 'Accessibility Specialist', 'Interviewed', 22],
  ['Bellhollow Retail', 'E-commerce Developer', 'Rejected', 28],
  ['Cinderpath Security', 'Frontend Engineer', 'Rejected', 45, 30],
  ['Driftmark Maps', 'Mapping UI Engineer', 'Rejected', 14, undefined, 'Wanted 5+ years of WebGL.'],
  ['Emberleigh Foods', 'Web Developer', 'Rejected', 52],
  ['Foxglove Civic', 'Product Engineer', 'Rejected', 38, 26],
  ['Gallowhill Freight', 'Senior UI Engineer', 'Rejected', 60],
  ['Hearthstone Valley Co-op', 'Frontend Developer', 'Filled', 47, 35],
  ['Ironbark Outfitters', 'React Developer', 'Filled', 31],
  ['Juniper Kettle', 'UI Engineer', 'Filled', 58, 44, 'Position filled internally.'],
  ['Kestrel Harbor Labs', 'Frontend Engineer', 'Applied', 10],
];

export function createSampleApplications(today: Date = new Date()): NewApplication[] {
  return ROWS.map(([company, position, status, applied, followedUp, notes]) => ({
    dateApplied: daysAgo(applied, today),
    company,
    position,
    status,
    ...(followedUp !== undefined && { followedUpDate: daysAgo(followedUp, today) }),
    ...(notes !== undefined && { notes }),
  }));
}
