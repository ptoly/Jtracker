import type { Meta, StoryObj } from '@storybook/react-vite';
import { Placeholder } from './Placeholder';

const meta = {
  title: 'Placeholder',
  component: Placeholder,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Placeholder>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
