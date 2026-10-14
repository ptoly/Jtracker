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
    onReconnect: fn(),
    onDisconnect: fn(),
    onReload: fn(),
  },
} satisfies Meta<typeof ConnectionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SampleData: Story = {
  name: 'Sample data',
  args: { onConnect: fn(), onPreload: fn() },
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

export const SampleDataWithCsv: Story = {
  name: 'Sample data (browser can open files)',
  args: { onOpenCsv: fn(), onConnect: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open CSV file' }));
    await expect(args.onOpenCsv).toHaveBeenCalled();
  },
};

export const CsvReconnect: Story = {
  name: 'CSV file: allow again',
  args: {
    mode: 'csv-reconnect',
    fileName: 'Job hunt 2026.csv',
    onAllowCsv: fn(),
    onCloseCsv: fn(),
  },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Allow' }));
    await expect(args.onAllowCsv).toHaveBeenCalled();
  },
};

export const ReconnectWithCsv: Story = {
  name: 'Reconnect, or open a CSV file',
  args: { mode: 'reconnect', onOpenCsv: fn() },
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open CSV file' }));
    await expect(args.onOpenCsv).toHaveBeenCalled();
  },
};

/** The hosted demo in Chrome or Edge: sample data in this browser, a CSV file, or a download. */
export const Demo: Story = {
  name: 'Demo (sample data in this browser)',
  args: {
    demo: { persistent: true, source: null },
    onOpenCsv: fn(),
    onExportCsv: fn(),
    onResetDemo: fn(),
  },
  play: async ({ canvas, userEvent, args }) => {
    await expect(
      canvas.getByText('Demo with sample data. Your changes stay in this browser.'),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Reset sample data' }));
    await expect(args.onResetDemo).toHaveBeenCalled();
  },
};

/** The hosted demo in Safari or Firefox: no saving to a file, so Import and Export. */
export const DemoImportExport: Story = {
  name: 'Demo: Import and Export CSV',
  args: {
    demo: { persistent: true, source: null },
    onImportCsv: fn(),
    onExportCsv: fn(),
    onResetDemo: fn(),
  },
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Export CSV' }));
    await expect(args.onExportCsv).toHaveBeenCalled();
    // Import CSV opens the file chooser; choosing a file hands it over.
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('no file input');
    const file = new File(['Date,Company,Position,Status\n'], 'jobs.csv', { type: 'text/csv' });
    await userEvent.upload(input, file);
    await expect(args.onImportCsv).toHaveBeenCalledWith(file);
  },
};

export const DemoImported: Story = {
  name: 'Demo: an imported file',
  args: {
    demo: { persistent: true, source: 'Job hunt 2026.csv' },
    onImportCsv: fn(),
    onExportCsv: fn(),
    onResetDemo: fn(),
  },
};

export const DemoNoStorage: Story = {
  name: 'Demo: browser blocks storage',
  args: { demo: { persistent: false, source: null }, onOpenCsv: fn(), onResetDemo: fn() },
};
