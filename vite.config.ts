import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build the entire React app into ONE self-contained index.html so that
// Google Apps Script's HtmlService can serve it via createHtmlOutputFromFile('index').
//
// Output goes into ./gas (the clasp project root) WITHOUT wiping the *.gs
// backend files that live there (emptyOutDir: false).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: 'gas',
    emptyOutDir: false,
    target: 'es2018',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
