import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { createSampleApplications } from '../../storage/sampleData';
import { ApplicationsTable } from './ApplicationsTable';

/** Fixed so ages, follow-up-due and dates don't drift from day to day. */
const STORY_TODAY = new Date(2026, 9, 10);

const sampleApplications = createSampleApplications(STORY_TODAY).map((app, index) => ({
  ...app,
  id: `story-${index + 1}`,
}));

/** 250 rows: the sample set repeated, each copy shifted ~2 months earlier, so dates span two years. */
function manyApplications(count: number) {
  const today = STORY_TODAY;
  const copies = Math.ceil(count / sampleApplications.length);
  return Array.from({ length: copies }, (_, copy) =>
    createSampleApplications(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() - copy * 61),
    ),
  )
    .flat()
    .slice(0, count)
    .map((app, index) => ({ ...app, id: `story-many-${index + 1}` }));
}

const meta = {
  title: 'ApplicationsTable',
  component: ApplicationsTable,
  args: { applications: sampleApplications, followUpDays: 10, today: STORY_TODAY },
} satisfies Meta<typeof ApplicationsTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NeedsFollowUpTab: Story = {
  name: 'Needs Follow Up tab',
  play: async ({ canvas, userEvent }) => {
    const tab = canvas.getByRole('tab', { name: 'Needs Follow Up' });
    await userEvent.click(tab);
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  },
};

export const NoSearchResults: Story = {
  name: 'No search results',
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('searchbox'), 'zzz-no-match');
    await expect(canvas.getByText(/No applications match/)).toBeVisible();
  },
};

export const ManyApplications: Story = {
  name: 'Many applications',
  args: { applications: manyApplications(250) },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('Page 1 of 3')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(canvas.getByText('Page 2 of 3')).toBeVisible();
  },
};

export const Empty: Story = {
  args: { applications: [] },
};
