import { toIsoDate } from '../lib/dates';
import { DEFAULT_FOLLOW_UP_DAYS } from '../lib/derive';
import type { NewApplication, Status } from '../types/application';

// The demo's sample data: a design job search of ~120 applications over the
// last 90 days, built from word lists with a seeded random generator, so it's
// the same every time (only the dates move with `today`). All companies are
// fictional: invented compounds of uncommon words, checked against
// well-known company names.

const COUNT = 120;
const SPAN_DAYS = 90;
const SEED = 20261014;

/** A small seeded generator (mulberry32): the same sequence for the same seed. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  'Amber',
  'Bramble',
  'Cinder',
  'Dapple',
  'Eider',
  'Fennel',
  'Gorse',
  'Heron',
  'Inkle',
  'Juniper',
  'Kettle',
  'Lichen',
  'Marram',
  'Nettle',
  'Osier',
  'Pumice',
  'Quince',
  'Sedge',
  'Sorrel',
  'Tansy',
  'Umber',
  'Vetch',
  'Wicker',
  'Yarrow',
];
const SECOND = [
  'wick',
  'mere',
  'fold',
  'brook',
  'hollow',
  'crest',
  'thorn',
  'wren',
  'gate',
  'moss',
  'ridge',
  'vale',
  'loft',
  'combe',
  'stead',
];
const KIND = [
  'Labs',
  'Studio',
  'Health',
  'Systems',
  'Co.',
  'Collective',
  'Works',
  'Analytics',
  'Bank',
  'Learning',
  'Travel',
  'Media',
  'Logistics',
  'Insurance',
  'Games',
  'Software',
  'Energy',
  'Foods',
  'Civic',
  'Robotics',
];

/** A few long names, so wrapping and truncation show. */
const LONG_COMPANIES = [
  'Hollowmere Regional Health Partners',
  'Pumicecrest Municipal Credit Union',
  'Lichenwren Outdoor & Expedition Supply',
];

const POSITIONS = [
  'Product Designer',
  'Senior Product Designer',
  'UX Designer',
  'Design Engineer',
  'Design Systems Designer',
  'UX Researcher',
  'Staff Product Designer',
  'Content Designer',
  'Interaction Designer',
  'Lead Product Designer',
  'Senior UX Designer',
  'Product Designer, Growth',
  'Accessibility Designer',
  'Principal Product Designer',
];

const LONG_POSITIONS = [
  'Senior Product Designer, Design Systems & Accessibility',
  'Lead UX Researcher, Growth and Retention',
];

const NOTES = [
  'Referral from a former colleague.',
  'Portfolio review requested.',
  'Asked for a design exercise.',
  'Recruiter reached out first.',
  'Salary range not listed.',
  'Hybrid, two days in the office.',
  'Posting may be stale.',
  'Second round scheduled.',
  'Take-home submitted.',
  'Wanted more motion design work.',
  'Contract-to-hire.',
  'Emailed the hiring manager.',
  'Team is rebuilding its design system.',
  'Remote, US only.',
  'Whiteboard challenge in round two.',
  'Met the team at a meetup.',
];

/** Companies with 2–3 applications each, so the "applied before" alert has something to show. */
const REPEATS = [3, 2, 3, 2, 2];

/** Applications still at Applied and past the follow-up threshold. */
const FOLLOW_UP_DUE = 18;

/** How the rest split once the recent ones and the due ones are set. */
const OLDER_STATUSES: [Status, number][] = [
  ['Followed Up', 16],
  ['Interviewed', 9],
  ['Interviewed - Rejected', 5],
  ['Filled', 10],
];

function daysAgo(n: number, today: Date): string {
  return toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

/**
 * Invented names, "Heronbrook Labs", "Tansycombe Health", …, each with its
 * own first word, so a search for one never finds another.
 */
function companyNames(count: number, random: () => number): string[] {
  const stems = new Set<string>();
  while (stems.size < count) stems.add(`${pick(FIRST, random)}${pick(SECOND, random)}`);
  return [...stems].map((stem) => `${stem} ${pick(KIND, random)}`);
}

interface Plan {
  company: string;
  position: string;
  age: number;
  status: Status;
  followedUpAgo?: number;
  notes?: string;
}

/** The sample rows, as of `today`. Same companies, positions and spread every time. */
export function createSampleApplications(today: Date = new Date()): NewApplication[] {
  const random = seededRandom(SEED);

  // Companies: the repeat ones, then singles (three of them long names).
  const repeatTotal = REPEATS.reduce((sum, n) => sum + n, 0);
  const names = companyNames(REPEATS.length + COUNT - repeatTotal, random);
  const repeatNames = names.slice(0, REPEATS.length);
  const singles = names.slice(REPEATS.length);
  singles.splice(0, LONG_COMPANIES.length, ...LONG_COMPANIES);
  const companies = shuffle(
    [...repeatNames.flatMap((name, i) => Array<string>(REPEATS[i] ?? 0).fill(name)), ...singles],
    random,
  );

  // Ages spread over the span, newest first, with a little jitter.
  const plans: Plan[] = companies.map((company, i) => ({
    company,
    position: pick(POSITIONS, random),
    age: Math.min(SPAN_DAYS, Math.round((i * SPAN_DAYS) / (COUNT - 1) + random() * 1.5)),
    status: 'Applied',
  }));

  // A company's repeat applications are for different roles.
  for (const name of repeatNames) {
    const rows = plans.filter((plan) => plan.company === name);
    const roles = shuffle(POSITIONS, random);
    rows.forEach((plan, i) => {
      plan.position = roles[i] ?? plan.position;
    });
  }
  LONG_POSITIONS.forEach((position, i) => {
    const plan = plans[20 + i * 37];
    if (plan) plan.position = position;
  });

  // Statuses: recent ones are still Applied (not due yet); of the older ones,
  // FOLLOW_UP_DUE stay Applied (due), and the rest split as planned, mostly rejections.
  const older = shuffle(
    plans.filter((plan) => plan.age >= DEFAULT_FOLLOW_UP_DAYS),
    random,
  );
  let next = FOLLOW_UP_DUE;
  for (const [status, count] of OLDER_STATUSES) {
    for (const plan of older.slice(next, next + count)) plan.status = status;
    next += count;
  }
  for (const plan of older.slice(next)) plan.status = 'Rejected';

  // Follow-ups: every Followed Up row, about half the interviews, a few rejections.
  for (const plan of plans) {
    const chance =
      plan.status === 'Followed Up'
        ? 1
        : plan.status === 'Interviewed' || plan.status === 'Interviewed - Rejected'
          ? 0.5
          : plan.status === 'Rejected'
            ? 0.15
            : 0;
    if (random() < chance) {
      const after = 5 + Math.floor(random() * 10);
      plan.followedUpAgo = Math.max(0, plan.age - after);
    }
  }

  // Notes on about one row in six.
  shuffle(plans, random)
    .slice(0, Math.round(COUNT / 6))
    .forEach((plan, i) => {
      plan.notes = NOTES[i % NOTES.length] ?? '';
    });

  return plans.map((plan) => ({
    dateApplied: daysAgo(plan.age, today),
    company: plan.company,
    position: plan.position,
    status: plan.status,
    ...(plan.followedUpAgo !== undefined && { followedUpDate: daysAgo(plan.followedUpAgo, today) }),
    ...(plan.notes !== undefined && { notes: plan.notes }),
  }));
}
