import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: process.env.DEV_HOST ?? 'localhost',
    proxy: { '/api': 'http://localhost:3000' },
  },
});
