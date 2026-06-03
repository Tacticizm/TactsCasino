import { defineConfig } from 'vite';

// Relative base so the build works inside a Capacitor WebView / GitHub Pages
// subpath without rewriting asset URLs.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
