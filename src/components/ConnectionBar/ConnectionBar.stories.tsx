import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { ConnectionBar } from './ConnectionBar';

// Stories never load Google's scripts: every action is a spy.
const meta = {
  title: 'ConnectionBar',
  component: ConnectionBar,
  args: {
    mode: 'sample',
    sheetName: 'Job search 2026',
    onConnect: fn(),
    onReconnect: fn(),
    onDisconnect: fn(),
    onReload: fn(),
    onPreload: fn(),
  },
} satisfies Meta<typeof ConnectionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SampleData: Story = {
  name: 'Sample data',
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Connect Google Sheet' }));
    await expect(args.onPreload).toHaveBeenCalled();
    await expect(args.onConnect).toHaveBeenCalled();
  },
};

export const Reconnect: Story = {
  args: { mode: 'reconnect' },
};

export const SyncPaused: Story = {
  name: 'Sign-in timed out while away',
  args: { mode: 'sheet', syncPaused: true },
};

export const SessionExpired: Story = {
  name: 'Sign-in couldn’t renew',
  args: { mode: 'sheet', sessionExpired: true },
};
