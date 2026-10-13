import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef } from 'react';
import { expect, fn, waitFor } from 'storybook/test';
import { createSampleApplications } from '../../storage/sampleData';
import { ApplicationForm, type ApplicationFormHandle } from './ApplicationForm';

/** Fixed so the default date and match ages don't drift from day to day. */
const STORY_TODAY = new Date(2026, 9, 10);

const sampleApplications = createSampleApplications(STORY_TODAY).map((app, index) => ({
  ...app,
  id: `story-${index + 1}`,
}));

const meta = {
  title: 'ApplicationForm',
  component: ApplicationForm,
  args: {
    applications: [
      ...sampleApplications,
      // A second Copperwick application, entered with a suffix.
      {
        id: 'story-copperwick-2',
        dateApplied: '2026-03-02',
        company: 'Copperwick Labs, Inc.',
        position: 'Frontend Engineer',
        status: 'Rejected',
      },
    ],
    today: STORY_TODAY,
    onAdd: fn(async () => {}),
    onManagePositions: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 840 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ApplicationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ValidationErrors: Story = {
  name: 'Validation errors',
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Add Application' }));
    const company = canvas.getByRole('textbox', { name: 'Company/Search' });
    await expect(company).toBeRequired();
    await expect(company).toHaveAttribute('aria-invalid', 'true');
    await expect(company).toHaveAccessibleDescription('Enter a company.');
    await expect(company).toHaveFocus();
    await expect(args.onAdd).not.toHaveBeenCalled();
  },
};

export const AppliedBefore: Story = {
  name: 'Applied before',
  play: async ({ canvas, canvasElement, userEvent }) => {
    const company = canvas.getByRole('textbox', { name: 'Company/Search' });
    // Case, spaces and the LLC suffix don't matter.
    await userEvent.type(company, '  copperwick LABS llc');
    await expect(await canvas.findByText('Applied to Copperwick Labs before:')).toBeVisible();
    const items = canvas.getAllByRole('listitem');
    await expect(items).toHaveLength(2);
    // Newest first; the age only while still Applied.
    await expect(items[0]).toHaveTextContent(
      /^Senior React Developer.*September 28, 2026.*Applied.*12 days$/,
    );
    await expect(items[1]).toHaveTextContent(/^Frontend Engineer.*March 2, 2026.*Rejected$/);
    await expect(canvasElement.querySelector('[aria-live="polite"]')).toHaveTextContent(
      'Applied to Copperwick Labs before: 2 applications',
    );

    // Dismissed, it stays away for this company; focus returns to the field.
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }));
    await expect(canvas.queryByText('Applied to Copperwick Labs before:')).toBeNull();
    await expect(company).toHaveFocus();
  },
};

export const PartialMatch: Story = {
  name: 'Partial match (several companies)',
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: 'Company/Search' }), 'lab');
    await expect(await canvas.findByText('Applied to Copperwick Labs before:')).toBeVisible();
    await expect(canvas.getByText('Applied to Yarrow Point Labs before:')).toBeVisible();
    await expect(canvas.getByText('Applied to Kestrel Harbor Labs before:')).toBeVisible();
  },
};

export const ClearCompany: Story = {
  name: 'Clear the company',
  play: async ({ canvas, userEvent }) => {
    const company = canvas.getByRole('textbox', { name: 'Company/Search' });
    await userEvent.type(company, 'Ninefold');
    await canvas.findByText('Applied to Ninefold Robotics before:');
    await userEvent.click(canvas.getByRole('button', { name: 'Clear company' }));
    await expect(company).toHaveValue('');
    await expect(company).toHaveFocus();
    await expect(canvas.queryByText(/Applied to .+ before:/)).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Clear company' })).toBeNull();
  },
};

export const AddNote: Story = {
  name: 'Add a note',
  play: async ({ canvas, userEvent }) => {
    const date = canvas.getByLabelText('Date Applied');
    await expect(date).toHaveValue('2026-10-10');
    await expect(date).toHaveAccessibleDescription('Defaults to today');
    await userEvent.click(canvas.getByRole('button', { name: 'Add Note (optional)' }));
    await waitFor(() =>
      expect(canvas.getByRole('textbox', { name: 'Note (optional)' })).toHaveFocus(),
    );
  },
};

/** What the table's "Add application for …" does: fills Company and moves on to Position. */
export const FillFromSearch: Story = {
  name: 'Filled from a table search',
  render: function Render(args) {
    const ref = useRef<ApplicationFormHandle>(null);
    return (
      <>
        <p>
          <button
            type="button"
            className="btn"
            onClick={() => ref.current?.fillCompany('Acme Robotics')}
          >
            Add application for “Acme Robotics”
          </button>
        </p>
        <ApplicationForm {...args} ref={ref} />
      </>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Add application for/ }));
    await expect(canvas.getByRole('textbox', { name: 'Company/Search' })).toHaveValue(
      'Acme Robotics',
    );
    await expect(canvas.getByRole('combobox', { name: 'Position' })).toHaveFocus();
  },
};

export const ManagePositions: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Manage Positions' }));
    await expect(args.onManagePositions).toHaveBeenCalled();
  },
};

export const EmptyPositionList: Story = {
  name: 'Empty position list',
  args: { applications: [] },
};
