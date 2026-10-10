import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { NodePackageImporter } from 'sass';

export default defineConfig({
  plugins: [react()],
  css: {
    // Dev only: DevTools shows the .scss file and line for each declaration.
    devSourcemap: true,
    preprocessorOptions: {
      scss: { importers: [new NodePackageImporter()] },
    },
  },
});
