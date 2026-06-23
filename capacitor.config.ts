import type { CapacitorConfig } from '@capacitor/cli';

// Cấu hình Capacitor đặt ở GỐC repo (chuẩn Capacitor: project root = nơi có
// package.json; android/ ios/ sinh ra ở đây). webDir trỏ tới bản build web đa-file
// do vite.config.mobile.ts xuất ra (mobile/www).
const config: CapacitorConfig = {
  appId: 'com.familywallet.app',
  appName: 'Family Wallet',
  webDir: 'mobile/www',
  android: {
    allowMixedContent: false,
  },
};

export default config;
