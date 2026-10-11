import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { StorageError } from '../../storage/errors';
import { Notice, SaveError } from './Notice';

const meta = {
  title: 'Notice',
  component: Notice,
  args: { tone: 'warning', children: 'Sample data. Connect your Google Sheet to use your own.' },
} satisfies Meta<typeof Notice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Warning: Story = {};

export const SheetProblems: Story = {
  name: 'Sheet problems (dismissible)',
  args: {
    onDismiss: fn(),
    dismissLabel: 'Dismiss sheet problems',
    children: (
      <>
        <div className="notice__title">
          2 rows in Sheet1 need a look. They’re shown as they are:
        </div>
        <ul className="notice__list">
          <li>Row 4: status “Ghosted” not recognized</li>
          <li>Row 9: no date</li>
        </ul>
      </>
    ),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss sheet problems' }));
    await expect(args.onDismiss).toHaveBeenCalled();
  },
};

export const SaveFailedWithRetry: Story = {
  name: 'Save failed, with Retry',
  args: { tone: 'error', children: null },
  render: () => (
    <SaveError
      error={new StorageError('network', 'Couldn’t reach Google Sheets. Check your connection.')}
      fallback="Couldn’t save."
      onRetry={fn()}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent('Couldn’t reach Google Sheets');
    await expect(canvas.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  },
};

export const SaveFailedNoRetry: Story = {
  name: 'Save failed, retry can’t help',
  args: { tone: 'error', children: null },
  render: () => (
    <SaveError
      error={
        new StorageError(
          'not-found',
          'This application is no longer in the sheet. Reload to see the latest.',
        )
      }
      fallback="Couldn’t save."
      onRetry={fn()}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  },
};
