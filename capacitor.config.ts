import type { CapacitorConfig } from '@capacitor/cli';

/**
 * iOS portrait game shell:
 * - contentInset never → Safe Area only via CSS env() / --safe-*
 * - base './' on Vite → relative assets for offline WebView
 */
const config: CapacitorConfig = {
  // 独立包名，避免覆盖手机上其它调试包（原 com.example.portraitwebgpubase）
  appId: 'com.zhixuan90103.hauntedhouse',
  appName: 'Haunted House',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    backgroundColor: '#0b1020',
    scrollEnabled: false,
  },
};

export default config;
