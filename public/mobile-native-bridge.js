/**
 * GlobusMarket native helpers (Capacitor). No-op in regular browsers.
 * Loaded by index.html — does not change web checkout unless isNativePlatform().
 */
(function (global) {
  'use strict';

  function isNative() {
    try {
      return !!(
        global.Capacitor &&
        typeof global.Capacitor.isNativePlatform === 'function' &&
        global.Capacitor.isNativePlatform()
      );
    } catch {
      return false;
    }
  }

  function getPlugin(name) {
    if (!isNative()) return null;
    try {
      const cap = global.Capacitor;
      if (cap.Plugins && cap.Plugins[name]) return cap.Plugins[name];
      if (typeof cap.registerPlugin === 'function') return cap.registerPlugin(name);
    } catch {
      return null;
    }
    return null;
  }

  var paymeBrowserHooked = false;
  var statusBarReady = false;
  var statusBarRetries = 0;

  function hookPaymeBrowserFinished(Browser) {
    if (paymeBrowserHooked || !Browser || typeof Browser.addListener !== 'function') return;
    paymeBrowserHooked = true;
    Browser.addListener('browserFinished', function () {
      var num = '';
      try {
        num = String(global.localStorage.getItem('gm_payme_pending') || '').trim();
        global.localStorage.removeItem('gm_payme_pending');
      } catch (e) {}
      if (!num) return;
      var trackPath = '/track/' + encodeURIComponent(num);
      if (global.location.pathname === trackPath) return;
      global.location.href = trackPath;
    });
  }

  function setupAppUrlOpen() {
    var App = getPlugin('App');
    if (!App || typeof App.addListener !== 'function') return;
    App.addListener('appUrlOpen', function (ev) {
      var raw = String((ev && ev.url) || '');
      if (!raw || raw.indexOf('/track/') === -1) return;
      var Browser = getPlugin('Browser');
      if (Browser && typeof Browser.close === 'function') {
        Browser.close().catch(function () {});
      }
      try {
        var u = new URL(raw);
        global.location.href = u.pathname + u.search + u.hash;
      } catch {
        global.location.href = raw;
      }
    });
  }

  /**
   * @param {string} url Payme checkout URL
   * @param {string} [orderNumber]
   * @returns {Promise<boolean>} true if opened in native in-app browser
   */
  async function openPaymentUrl(url, orderNumber) {
    if (!isNative()) return false;
    var Browser = getPlugin('Browser');
    if (!Browser || typeof Browser.open !== 'function') return false;
    var checkoutUrl = String(url || '').trim();
    if (!checkoutUrl) return false;
    var pending = String(orderNumber || '').trim();
    if (pending) {
      try {
        global.localStorage.setItem('gm_payme_pending', pending);
      } catch (e) {}
    }
    hookPaymeBrowserFinished(Browser);
    await Browser.open({ url: checkoutUrl, presentationStyle: 'fullscreen' });
    return true;
  }

  function appIsVisible() {
    try {
      var phone = document.getElementById('phone');
      return !!(phone && phone.classList.contains('show-app'));
    } catch (e) {
      return false;
    }
  }

  /**
   * Edge-to-edge status bar.
   * Intro (dark) → LIGHT icons; shop (light header) → DARK icons.
   * Requires native rebuild: contentInset never + @capacitor/status-bar synced.
   */
  function syncStatusBar() {
    if (!isNative()) return false;
    var StatusBar = getPlugin('StatusBar');
    if (!StatusBar) return false;
    try {
      document.documentElement.classList.add('native-edge');
    } catch (e) {}
    var style = appIsVisible() ? 'DARK' : 'LIGHT';
    var tasks = [];
    if (typeof StatusBar.setOverlaysWebView === 'function') {
      tasks.push(StatusBar.setOverlaysWebView({ overlay: true }));
    }
    if (typeof StatusBar.setStyle === 'function') {
      tasks.push(StatusBar.setStyle({ style: style }));
    }
    if (typeof StatusBar.show === 'function') {
      tasks.push(StatusBar.show());
    }
    Promise.all(
      tasks.map(function (p) {
        return Promise.resolve(p).catch(function () {});
      })
    ).catch(function () {});
    statusBarReady = true;
    return true;
  }

  function setupStatusBar() {
    if (syncStatusBar()) {
      watchAppChrome();
      return;
    }
    // Capacitor bridge may load after this script on remote server URL.
    if (statusBarRetries >= 40) return;
    statusBarRetries += 1;
    setTimeout(setupStatusBar, 250);
  }

  function watchAppChrome() {
    var phone = document.getElementById('phone');
    if (!phone || typeof MutationObserver !== 'function') return;
    var obs = new MutationObserver(function () {
      syncStatusBar();
    });
    obs.observe(phone, { attributes: true, attributeFilter: ['class'] });
  }

  global.GlobusNative = {
    isNative: isNative,
    openPaymentUrl: openPaymentUrl,
    syncStatusBar: syncStatusBar
  };

  function bootNative() {
    if (!isNative()) return;
    setupAppUrlOpen();
    setupStatusBar();
  }

  if (isNative()) {
    bootNative();
  } else {
    // Remote WebView: Capacitor injects after first paint sometimes.
    document.addEventListener('DOMContentLoaded', function () {
      if (isNative()) bootNative();
    });
    global.addEventListener('capacitorReady', bootNative);
    setTimeout(function () {
      if (isNative() && !statusBarReady) bootNative();
    }, 800);
  }
})(typeof window !== 'undefined' ? window : globalThis);
