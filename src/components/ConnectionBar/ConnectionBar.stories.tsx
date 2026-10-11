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
    tab: 'Sheet1',
    onConnect: fn(),
    onReconnect: fn(),
    onDisconnect: fn(),
    onReload: fn(),
    onTabChange: fn(),
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

export const Connected: Story = {
  args: { mode: 'sheet' },
};

export const SessionExpired: Story = {
  name: 'Session expired',
  args: { mode: 'sheet', sessionExpired: true },
};

export const ChangeTab: Story = {
  name: 'Change the sheet tab',
  args: { mode: 'sheet' },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByText('Sheet settings'));
    const input = canvas.getByRole('textbox', { name: 'Sheet tab name' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Applications{Enter}');
    await expect(args.onTabChange).toHaveBeenCalledWith('Applications');
  },
};
