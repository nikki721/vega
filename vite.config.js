import { defineConfig } from 'vite';

// base: './' keeps every asset reference relative, so the exact same build
// output works from the repo root today and from a GitHub Pages project
// path (e.g. /academic-diary/) later, with no changes needed at deploy time.
export default defineConfig({
  base: './',
});
