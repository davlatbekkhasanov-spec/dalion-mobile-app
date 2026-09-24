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

  /**
   * Edge-to-edge: transparent status bar over the WebView.
   * Light app chrome → DARK status icons (time, battery readable on white).
   */
  function setupStatusBar() {
    var StatusBar = getPlugin('StatusBar');
    if (!StatusBar) return;
    try {
      document.documentElement.classList.add('native-edge');
    } catch (e) {}
    var tasks = [];
    if (typeof StatusBar.setOverlaysWebView === 'function') {
      tasks.push(StatusBar.setOverlaysWebView({ overlay: true }));
    }
    if (typeof StatusBar.setStyle === 'function') {
      tasks.push(StatusBar.setStyle({ style: 'DARK' }));
    }
    if (typeof StatusBar.show === 'function') {
      tasks.push(StatusBar.show());
    }
    Promise.all(
      tasks.map(function (p) {
        return Promise.resolve(p).catch(function () {});
      })
    ).catch(function () {});
  }

  global.GlobusNative = {
    isNative: isNative,
    openPaymentUrl: openPaymentUrl
  };

  if (isNative()) {
    setupAppUrlOpen();
    setupStatusBar();
  }
})(typeof window !== 'undefined' ? window : globalThis);
