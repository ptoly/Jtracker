import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, waitFor } from 'storybook/test';
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 160 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SheetActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const KeyboardMenu: Story = {
  name: 'Menu from the keyboard',
  play: async ({ canvas, userEvent }) => {
    const toggle = canvas.getByRole('button', { name: 'More actions' });
    await expect(toggle).toHaveAttribute('aria-haspopup', 'menu');
    toggle.focus();

    // Enter opens on the first item.
    await userEvent.keyboard('{Enter}');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const settings = canvas.getByRole('menuitem', { name: 'Sheet settings…' });
    const disconnect = canvas.getByRole('menuitem', { name: 'Disconnect' });
    await waitFor(() => expect(settings).toHaveFocus());

    // Arrows move and wrap; Home and End jump; a letter jumps to its item.
    await userEvent.keyboard('{ArrowDown}');
    await expect(disconnect).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(settings).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(disconnect).toHaveFocus();
    await userEvent.keyboard('{Home}');
    await expect(settings).toHaveFocus();
    await userEvent.keyboard('d');
    await expect(disconnect).toHaveFocus();

    // Escape closes and returns focus to the button.
    await userEvent.keyboard('{Escape}');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveFocus();

    // ↑ opens on the last item.
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(disconnect).toHaveFocus());
    await userEvent.keyboard('{Escape}');
  },
};

export const ChangeTab: Story = {
  name: 'Change the sheet tab',
  play: async ({ canvas, userEvent, args }) => {
    const toggle = canvas.getByRole('button', { name: 'More actions' });
    await userEvent.click(toggle);
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Sheet settings…' }));
    const input = canvas.getByRole('textbox', { name: 'Sheet tab name' });
    await waitFor(() => expect(input).toHaveFocus());
    await userEvent.clear(input);
    await userEvent.type(input, 'Applications{Enter}');
    await expect(args.onTabChange).toHaveBeenCalledWith('Applications');
    await waitFor(() => expect(toggle).toHaveFocus());
  },
};

export const Disconnect: Story = {
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'More actions' }));
    await userEvent.click(canvas.getByRole('menuitem', { name: 'Disconnect' }));
    await expect(args.onDisconnect).toHaveBeenCalled();
  },
};
