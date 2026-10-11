import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { SheetActions } from './SheetActions';

const meta = {
  title: 'SheetActions',
  component: SheetActions,
  args: {
    tab: 'Sheet1',
    onReload: fn(),
    onDisconnect: fn(),
    onTabChange: fn(),
  },
  // Room below for the menu, which drops down right-aligned.
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 240 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SheetActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ChangeTab: Story = {
  name: 'Change the sheet tab',
  play: async ({ canvas, userEvent, args }) => {
    const toggle = canvas.getByRole('button', { name: 'More sheet options' });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(canvas.getByRole('button', { name: 'Change sheet tab' }));
    const input = canvas.getByRole('textbox', { name: 'Sheet tab name' });
    await expect(input).toHaveFocus();
    await userEvent.clear(input);
    await userEvent.type(input, 'Applications{Enter}');
    await expect(args.onTabChange).toHaveBeenCalledWith('Applications');
    await expect(toggle).toHaveFocus();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  },
};

export const EscapeCloses: Story = {
  name: 'Escape closes the menu',
  play: async ({ canvas, userEvent }) => {
    const toggle = canvas.getByRole('button', { name: 'More sheet options' });
    await userEvent.click(toggle);
    await userEvent.keyboard('{Escape}');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveFocus();
  },
};
