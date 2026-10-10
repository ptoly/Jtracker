import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn } from 'storybook/test';
import { createSampleApplications } from '../../storage/sampleData';
import type { Application, ApplicationPatch } from '../../types/application';
import { ApplicationsTable, type ApplicationsTableProps } from './ApplicationsTable';

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

/** Applies a patch the way the storage adapter does: undefined clears a field. */
function applyPatch(app: Application, patch: ApplicationPatch): Application {
  return Object.fromEntries(
    Object.entries({ ...app, ...patch }).filter(([, value]) => value !== undefined),
  ) as unknown as Application;
}

/** Keeps changes in story state, so edits and deletes stick; the args spies record calls. */
function StatefulTable(args: ApplicationsTableProps) {
  const [applications, setApplications] = useState(args.applications);
  async function onUpdate(id: string, patch: ApplicationPatch) {
    await args.onUpdate(id, patch);
    const current = applications.find((app) => app.id === id);
    if (!current) throw new Error(`Application not found: ${id}`);
    const updated = applyPatch(current, patch);
    setApplications((prev) => prev.map((app) => (app.id === id ? updated : app)));
    return updated;
  }
  async function onDelete(id: string) {
    await args.onDelete(id);
    setApplications((prev) => prev.filter((app) => app.id !== id));
  }
  return (
    <ApplicationsTable
      {...args}
      applications={applications}
      onUpdate={onUpdate}
      onDelete={onDelete}
    />
  );
}

const meta = {
  title: 'ApplicationsTable',
  component: ApplicationsTable,
  args: {
    applications: sampleApplications,
    followUpDays: 10,
    today: STORY_TODAY,
    onUpdate: fn(),
    onDelete: fn(),
  },
  render: (args) => <StatefulTable {...args} />,
  // Rendered inside the card it sits in on the page.
  decorators: [
    (Story) => (
      <section className="card card--clip" aria-label="Applications">
        <Story />
      </section>
    ),
  ],
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

export const RowInEditMode: Story = {
  name: 'Row in edit mode',
  play: async ({ canvas, userEvent }) => {
    const [firstEdit] = canvas.getAllByRole('button', { name: /^Edit .+ application$/ });
    if (!firstEdit) throw new Error('No Edit button');
    await userEvent.click(firstEdit);
    await expect(canvas.getByLabelText('Date applied')).toHaveFocus();
    await expect(
      canvas.getAllByRole('button', { name: /^Edit .+ application$/ })[0],
    ).toBeDisabled();
  },
};

export const EditWithValidationError: Story = {
  name: 'Edit with validation error',
  play: async ({ canvas, userEvent, args }) => {
    const [firstEdit] = canvas.getAllByRole('button', { name: /^Edit .+ application$/ });
    if (!firstEdit) throw new Error('No Edit button');
    await userEvent.click(firstEdit);
    const company = canvas.getByRole('textbox', { name: 'Company' });
    await userEvent.clear(company);
    await userEvent.keyboard('{Enter}');
    await expect(company).toHaveAttribute('aria-invalid', 'true');
    await expect(company).toHaveAccessibleDescription('Enter a company.');
    await expect(company).toHaveFocus();
    await expect(args.onUpdate).not.toHaveBeenCalled();
  },
};

export const StatusChangeToFollowedUp: Story = {
  name: 'Status change to Followed Up',
  play: async ({ canvas, userEvent, args }) => {
    const select = canvas.getByRole('combobox', {
      name: 'Status, Copperwick Labs, Senior React Developer',
    });
    await userEvent.selectOptions(select, 'Followed Up');
    await expect(args.onUpdate).toHaveBeenCalledWith(expect.any(String), {
      status: 'Followed Up',
      followedUpDate: '2026-10-10',
    });
    await expect(select).toHaveValue('Followed Up');
    await expect(await canvas.findByText('Status updated')).toBeInTheDocument();
  },
};

export const DeleteApplication: Story = {
  name: 'Delete application',
  play: async ({ canvas, userEvent, args }) => {
    const [firstDelete] = canvas.getAllByRole('button', { name: /^Delete .+ application$/ });
    if (!firstDelete) throw new Error('No Delete button');
    const name = firstDelete.getAttribute('aria-label') ?? '';
    await userEvent.click(firstDelete);
    const dialog = await canvas.findByRole('dialog', { name: 'Delete application?' });
    await expect(canvas.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await userEvent.click(canvas.getByRole('button', { name: 'Delete' }));
    await expect(args.onDelete).toHaveBeenCalledTimes(1);
    await expect(dialog).not.toBeVisible();
    await expect(canvas.queryByRole('button', { name })).not.toBeInTheDocument();
  },
};
