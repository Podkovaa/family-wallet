import type { CapacitorConfig } from '@capacitor/cli';

// Cấu hình Capacitor cho bản mobile của Family Wallet.
// webDir = 'www' (tương đối với thư mục mobile/) là nơi `vite.config.mobile.ts`
// xuất bản build web đa-file để Capacitor bọc thành app native.
const config: CapacitorConfig = {
  appId: 'com.familywallet.app',
  appName: 'Family Wallet',
  webDir: 'www',
  android: {
    allowMixedContent: false,
  },
};

export default config;
