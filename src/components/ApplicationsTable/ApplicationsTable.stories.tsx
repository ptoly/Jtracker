import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, waitFor } from 'storybook/test';
import { StorageError } from '../../storage/errors';
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
  // Rendered inside the section it sits in on the page.
  decorators: [
    (Story) => (
      <section aria-label="Applications History">
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
    const tab = canvas.getByRole('tab', { name: /^Needs Follow Up \d+$/ });
    await userEvent.click(tab);
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    // Every row here says so in words, read with its status select.
    for (const select of canvas.getAllByRole('combobox', { name: /^Status, / })) {
      await expect(select).toHaveAccessibleDescription('Follow Up Due');
    }
  },
};

export const SearchShortcut: Story = {
  name: 'Search shortcut (⌘K / Ctrl+K)',
  play: async ({ canvas, userEvent }) => {
    const apple = /Mac|iPhone|iPad/.test(navigator.userAgent);
    await userEvent.keyboard(apple ? '{Meta>}k{/Meta}' : '{Control>}k{/Control}');
    await expect(canvas.getByRole('searchbox')).toHaveFocus();
  },
};

export const NoSearchResults: Story = {
  name: 'No search results',
  args: { onAddForSearch: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.type(canvas.getByRole('searchbox'), 'Acme Robotics');
    await expect(canvas.getByText(/No applications match/)).toBeVisible();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Add application for “Acme Robotics”' }),
    );
    await expect(args.onAddForSearch).toHaveBeenCalledWith('Acme Robotics');
  },
};

export const ManyApplications: Story = {
  name: 'Many applications',
  args: { applications: manyApplications(250) },
  play: async ({ canvas, userEvent }) => {
    const nav = canvas.getByRole('navigation', { name: 'Pagination' });
    await expect(canvas.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav).toHaveTextContent(/^Previous123Next$/);
    await userEvent.click(canvas.getByRole('button', { name: 'Next' }));
    await expect(canvas.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(canvas.getByRole('button', { name: 'Page 1' })).not.toHaveAttribute(
      'aria-current',
    );
  },
};

export const ManyPages: Story = {
  name: 'Many pages (ellipsis)',
  args: { applications: manyApplications(1000) },
  play: async ({ canvas, userEvent }) => {
    const nav = canvas.getByRole('navigation', { name: 'Pagination' });
    await expect(nav).toHaveTextContent(/^Previous12345…10Next$/);
    await userEvent.click(canvas.getByRole('button', { name: 'Page 5' }));
    await expect(nav).toHaveTextContent(/^Previous1…456…10Next$/);
    await userEvent.click(canvas.getByRole('button', { name: 'Page 10' }));
    await expect(nav).toHaveTextContent(/^Previous1…678910Next$/);
    await expect(canvas.getByRole('button', { name: 'Next' })).toBeDisabled();
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

/** Rows as a Google Sheet can deliver them: an unknown status and an unreadable date. */
const rowsWithProblems: Application[] = [
  {
    id: 'story-problem-1',
    dateApplied: '',
    company: 'Northwind Studio',
    position: 'Product Designer',
    status: '',
    unparsed: { dateApplied: 'last week', status: 'Ghosted' },
  },
  ...sampleApplications.slice(0, 3),
];

export const SheetRowProblems: Story = {
  name: 'Sheet rows with problems',
  args: { applications: rowsWithProblems },
  play: async ({ canvas }) => {
    const select = canvas.getByRole('combobox', {
      name: 'Status, Northwind Studio, Product Designer',
    });
    await expect(select).toHaveDisplayValue('Unrecognized: Ghosted');
    await expect(canvas.getByText('last week')).toBeInTheDocument();
  },
};

export const EditSendsOnlyChanges: Story = {
  name: 'Edit sends only changed fields',
  play: async ({ canvas, userEvent, args }) => {
    const [firstEdit] = canvas.getAllByRole('button', { name: /^Edit .+ application$/ });
    if (!firstEdit) throw new Error('No Edit button');
    await userEvent.click(firstEdit);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit notes' }));
    const dialog = await canvas.findByRole('dialog', { name: /^Notes for / });
    const notes = canvas.getByRole('textbox', { name: 'Notes' });
    await expect(notes).toHaveFocus();
    await userEvent.clear(notes);
    await userEvent.type(notes, 'Recruiter called');
    await userEvent.click(canvas.getByRole('button', { name: 'Done' }));
    await expect(dialog).not.toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onUpdate).toHaveBeenCalledWith(expect.any(String), {
      notes: 'Recruiter called',
    });
  },
};

let statusFailures = 0;

export const StatusChangeFails: Story = {
  name: 'Status change fails, then Retry',
  args: {
    onUpdate: fn(async () => {
      if (statusFailures > 0) {
        statusFailures -= 1;
        throw new StorageError('network', 'Couldn’t reach Google Sheets. Check your connection.');
      }
      return undefined as unknown as Application;
    }),
  },
  beforeEach: () => {
    statusFailures = 1;
  },
  play: async ({ canvas, userEvent, args }) => {
    const select = canvas.getByRole('combobox', {
      name: 'Status, Copperwick Labs, Senior React Developer',
    });
    await userEvent.selectOptions(select, 'Interviewed');
    const alert = await canvas.findByRole('alert');
    await expect(alert).toHaveTextContent('Couldn’t reach Google Sheets');
    // The table stays as it was until a save succeeds.
    await expect(select).not.toHaveValue('Interviewed');
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));
    await expect(args.onUpdate).toHaveBeenCalledTimes(2);
    await expect(select).toHaveValue('Interviewed');
    await expect(canvas.queryByRole('alert')).not.toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  name: 'Read-only (sheet without IDs)',
  args: { readOnly: true },
  play: async ({ canvas }) => {
    for (const select of canvas.getAllByRole('combobox', { name: /^Status, / })) {
      await expect(select).toBeDisabled();
    }
    for (const button of canvas.getAllByRole('button', {
      name: /^(Edit|Delete) .+ application$/,
    })) {
      await expect(button).toBeDisabled();
    }
  },
};

/** Under 720px: one card per application. Shown at a phone width in Storybook. */
const narrow = { globals: { viewport: { value: 'mobile2', isRotated: false } } };

export const NarrowCards: Story = {
  name: 'Narrow screen: cards',
  ...narrow,
  play: async ({ canvas }) => {
    const list = canvas.getByRole('list', { name: 'Applications' });
    await expect(list).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(canvas.getByRole('heading', { name: 'Copperwick Labs' })).toBeVisible();
    // The tabs stay on one row and scroll sideways.
    const tablist = canvas.getByRole('tablist');
    await expect(tablist.scrollWidth).toBeGreaterThan(tablist.clientWidth);
  },
};

export const NarrowEdit: Story = {
  name: 'Narrow screen: edit a card',
  ...narrow,
  play: async ({ canvas, userEvent, args }) => {
    const edit = canvas.getByRole('button', { name: 'Edit Copperwick Labs application' });
    await userEvent.click(edit);
    const company = canvas.getByRole('textbox', { name: 'Company' });
    await waitFor(() => expect(company).toHaveFocus());
    await userEvent.type(company, ' Inc');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onUpdate).toHaveBeenCalledWith(expect.any(String), {
      company: 'Copperwick Labs Inc',
    });
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Edit Copperwick Labs Inc application' }),
      ).toHaveFocus(),
    );
  },
};

export const NarrowSort: Story = {
  name: 'Narrow screen: sort the cards',
  ...narrow,
  play: async ({ canvas, userEvent }) => {
    const sort = canvas.getByRole('combobox', { name: 'Sort by' });
    await expect(sort).toHaveDisplayValue('Date applied, newest first');
    await userEvent.selectOptions(sort, 'Company, A to Z');
    const [first] = canvas.getAllByRole('heading', { level: 3 });
    await expect(first).toHaveTextContent('Ashgrove Learning');
  },
};
