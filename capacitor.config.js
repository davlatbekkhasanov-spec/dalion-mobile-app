'use strict';

/**
 * Capacitor shell for GlobusMarket (iOS / Android).
 * Production builds load the live HTTPS app so web and native share one UI.
 */
const serverUrl = String(
  process.env.CAPACITOR_SERVER_URL || 'https://globusmarket.org'
)
  .trim()
  .replace(/\/$/, '');

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'org.globusmarket.app',
  appName: 'GlobusMarket',
  webDir: 'mobile-www',
  android: {
    allowMixedContent: false,
    backgroundColor: '#050b18'
  },
  ios: {
    contentInset: 'never',
    scrollEnabled: true,
    backgroundColor: '#050b18',
    preferredContentMode: 'mobile'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#050b18',
      showSpinner: false,
      androidSplashResourceName: 'splash'
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#050b18'
    }
  },
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    androidScheme: 'https',
    allowNavigation: [
      'globusmarket.org',
      '*.globusmarket.org',
      'dalion-mobile-app-production.up.railway.app',
      '*.up.railway.app',
      'checkout.paycom.uz',
      '*.paycom.uz',
      '*.payme.uz'
    ]
  }
};

module.exports = config;
