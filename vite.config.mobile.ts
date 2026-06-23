import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build web cho vỏ Capacitor (mobile). CÙNG app React ở ./src nhưng xuất ra
// bundle ĐA-FILE bình thường (KHÔNG dùng vite-plugin-singlefile như bản GAS),
// đặt vào ./mobile/www để Capacitor bọc làm webDir native.
//
// Dùng: npx vite build --config vite.config.mobile.ts
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'mobile/www',
    emptyOutDir: true,
    target: 'es2018',
  },
});
