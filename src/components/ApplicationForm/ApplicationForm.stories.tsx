import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { createSampleApplications } from '../../storage/sampleData';
import { ApplicationForm } from './ApplicationForm';

/** Fixed so the default date and duplicate dates don't drift from day to day. */
const STORY_TODAY = new Date(2026, 9, 10);

const sampleApplications = createSampleApplications(STORY_TODAY).map((app, index) => ({
  ...app,
  id: `story-${index + 1}`,
}));

const meta = {
  title: 'ApplicationForm',
  component: ApplicationForm,
  args: {
    applications: sampleApplications,
    today: STORY_TODAY,
    onAdd: fn(async () => {}),
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1040 }}>
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
    await userEvent.click(canvas.getByRole('button', { name: 'Add application' }));
    const company = canvas.getByRole('textbox', { name: 'Company' });
    await expect(company).toHaveAttribute('aria-invalid', 'true');
    await expect(company).toHaveAccessibleDescription('Enter a company.');
    await expect(company).toHaveFocus();
    await expect(args.onAdd).not.toHaveBeenCalled();
  },
};

export const DuplicateWarning: Story = {
  name: 'Duplicate warning',
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: 'Company' }), 'copperwick labs');
    await userEvent.type(
      canvas.getByRole('combobox', { name: 'Position' }),
      'senior react developer',
    );
    await expect(
      canvas.getByText(/You applied to Copperwick Labs for Senior React Developer/),
    ).toBeVisible();
  },
};

export const EmptyPositionList: Story = {
  name: 'Empty position list',
  args: { applications: [] },
};
