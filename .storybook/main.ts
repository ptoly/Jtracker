import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
  // The app's icons (public/); Storybook uses favicon.svg from here for its own tab.
  staticDirs: ['../public'],
};

export default config;
