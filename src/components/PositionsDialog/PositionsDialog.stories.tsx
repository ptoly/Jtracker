import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, within } from 'storybook/test';
import { normalize } from '../../lib/applicationRules';
import { renameInList } from '../../lib/positions';
import type { PositionList } from '../../storage';
import type { Application } from '../../types/application';
import { PositionsDialog, type PositionsDialogProps } from './PositionsDialog';

const app = (id: number, position: string): Application => ({
  id: `story-${id}`,
  dateApplied: '2026-10-01',
  company: `Company ${id}`,
  position,
  status: 'Applied',
});

const APPLICATIONS = [
  app(1, 'Senior Product Designer'),
  app(2, 'Sr. Product Designer'),
  app(3, 'Sr. Product Designer'),
  app(4, 'UX Engineer'),
  app(5, 'Design Technologist'),
];

/** Keeps applications and the list in state, like the app does through storage. */
function StatefulDialog(props: Partial<PositionsDialogProps>) {
  const [applications, setApplications] = useState(APPLICATIONS);
  const [positions, setPositions] = useState<PositionList>({ added: [], hidden: [] });
  return (
    <PositionsDialog
      open
      onClose={() => undefined}
      {...props}
      applications={applications}
      positions={positions}
      onUpdate={async (change) => setPositions(change)}
      onRename={async (from, to) => {
        const changed = applications.filter((a) => normalize(a.position) === normalize(from));
        setApplications((prev) =>
          prev.map((a) => (normalize(a.position) === normalize(from) ? { ...a, position: to } : a)),
        );
        setPositions((list) => renameInList(list, from, to));
        return changed.length;
      }}
    />
  );
}

const meta = {
  title: 'PositionsDialog',
  component: PositionsDialog,
  args: {
    open: true,
    onClose: () => undefined,
    applications: APPLICATIONS,
    positions: { added: [], hidden: [] },
    onUpdate: async () => undefined,
    onRename: async () => 0,
  },
  render: (args) => <StatefulDialog readOnly={args.readOnly ?? false} />,
} satisfies Meta<typeof PositionsDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// The dialog is modal (top layer), so queries go through the document.
const page = () => within(document.body);

export const Default: Story = {};

export const RenameMerges: Story = {
  name: 'Rename merges into an existing position',
  play: async ({ userEvent }) => {
    await userEvent.click(
      await page().findByRole('button', { name: 'Rename Sr. Product Designer' }),
    );
    const input = page().getByRole('textbox', { name: 'New name for Sr. Product Designer' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Senior Product Designer');
    await expect(input).toHaveAccessibleDescription(
      'Changes 2 applications in the sheet. Merges into “Senior Product Designer”.',
    );
    await userEvent.click(page().getByRole('button', { name: 'Save' }));
    await expect(page().queryByText('Sr. Product Designer')).not.toBeInTheDocument();
    await expect(page().getByText('3 applications')).toBeVisible();
  },
};

export const RemoveAndRestore: Story = {
  name: 'Remove from suggestions, then restore',
  play: async ({ userEvent }) => {
    await userEvent.click(
      await page().findByRole('button', { name: 'Remove UX Engineer from suggestions' }),
    );
    const list = page().getByRole('list', { name: 'Positions' });
    await expect(within(list).queryByText('UX Engineer')).not.toBeInTheDocument();
    await userEvent.click(page().getByText('Removed from suggestions (1)'));
    await userEvent.click(page().getByRole('button', { name: 'Restore UX Engineer' }));
    await expect(within(list).getByText('UX Engineer')).toBeVisible();
  },
};

export const FindOrAdd: Story = {
  name: 'Find, then add a new position',
  play: async ({ userEvent }) => {
    const query = await page().findByRole('textbox', { name: 'Find or add a position' });
    await userEvent.type(query, 'staff');
    await expect(page().getByText('No positions match “staff”.')).toBeVisible();
    await userEvent.clear(query);
    await userEvent.type(query, 'Staff Designer{Enter}');
    await expect(page().getByText('Staff Designer')).toBeVisible();
    await expect(page().getByText('Added')).toBeVisible();
  },
};
