import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds both apps into /dist with separate HTML entry points
// Cloudflare Pages serves /shine.html and /launch.html
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        shine:  'shine.html',
        launch: 'launch.html',
      },
    },
  },
});
