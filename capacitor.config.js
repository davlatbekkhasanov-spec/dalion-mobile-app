'use strict';

/**
 * Capacitor shell — does not replace index.html.
 * When CAPACITOR_SERVER_URL is set, the WebView loads your live web app (same design as browser).
 */
const serverUrl = String(process.env.CAPACITOR_SERVER_URL || '')
  .trim()
  .replace(/\/$/, '');

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'org.globusmarket.app',
  appName: 'GlobusMarket',
  webDir: 'mobile-www',
  android: {
    allowMixedContent: false
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true
  }
};

if (serverUrl) {
  config.server = {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    androidScheme: serverUrl.startsWith('https://') ? 'https' : 'http'
  };
}

module.exports = config;
