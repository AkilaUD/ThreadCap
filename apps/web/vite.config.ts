import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, allowedHosts: true },
  preview: { allowedHosts: true, host: '0.0.0.0' },
  build: { outDir: 'dist', sourcemap: true },
});