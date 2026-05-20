/**
 * Tablo (orders.html) bilan bir xil signal — Web Audio «zangdor» + haptic.
 * courier-portal.html va orders.html ulashadi.
 */
(function (root) {
  const DEFAULT_SOUND_LS = 'gm_orders_sound_on';
  const DEFAULT_VOL_LS = 'gm_orders_sound_vol';

  function createOrderBoardSound(options) {
    const soundLs = (options && options.soundKey) || DEFAULT_SOUND_LS;
    const volLs = (options && options.volKey) || DEFAULT_VOL_LS;
    let webAudioCtx = null;

    function getSoundOn() {
      return root.localStorage.getItem(soundLs) !== '0';
    }
    function setSoundOn(on) {
      root.localStorage.setItem(soundLs, on ? '1' : '0');
    }
    function getSoundVolume() {
      const raw = root.localStorage.getItem(volLs);
      if (raw === null || raw === '') return 200;
      const n = Number(raw);
      if (!Number.isFinite(n)) return 200;
      return Math.max(0, Math.min(200, Math.round(n)));
    }
    function setSoundVolume(v) {
      const n = Math.max(0, Math.min(200, Math.round(Number(v))));
      root.localStorage.setItem(volLs, String(n));
    }
    function getAudioContext() {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      if (!webAudioCtx) webAudioCtx = new AC();
      return webAudioCtx;
    }
    function unlockAudio() {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    }

    /** kind 'new' = yangi buyurtma; 'route' = yo'lda */
    function playBeep(kind) {
      if (!getSoundOn()) return;
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const drive = getSoundVolume() / 100;
      if (drive <= 0) return;
      try {
        const t0 = ctx.currentTime;
        const makeup = ctx.createGain();
        makeup.gain.value = drive * 4.75;
        makeup.connect(ctx.destination);

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(6800, t0);
        lp.Q.setValueAtTime(0.45, t0);
        lp.connect(makeup);

        function bellPartial(start, freq, dur, peak, type) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, t0 + start);
          const a = t0 + start;
          const b = a + dur;
          const p = Math.max(0.0008, peak);
          g.gain.setValueAtTime(0.0001, a);
          g.gain.exponentialRampToValueAtTime(p, a + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, b);
          osc.connect(g);
          g.connect(lp);
          osc.start(a);
          osc.stop(b + 0.03);
        }

        if (kind === 'route') {
          bellPartial(0, 196, 0.14, 0.42, 'sine');
          bellPartial(0, 392, 0.3, 0.78, 'triangle');
          bellPartial(0.06, 523.25, 0.26, 0.62, 'sine');
          bellPartial(0.12, 659.25, 0.22, 0.5, 'sine');
        } else {
          bellPartial(0, 392, 0.16, 0.52, 'sine');
          bellPartial(0, 783.99, 0.44, 1, 'triangle');
          bellPartial(0.1, 987.77, 0.38, 0.82, 'triangle');
          bellPartial(0.2, 1174.66, 0.32, 0.62, 'sine');
          bellPartial(0.32, 1318.51, 0.24, 0.44, 'sine');
        }
      } catch (_) {}
    }

    function hapticPing(kind) {
      try {
        if (typeof root.navigator === 'undefined' || !root.navigator.vibrate) return;
        if (kind === 'route') root.navigator.vibrate([65, 40, 95]);
        else root.navigator.vibrate([95, 55, 95, 55, 180]);
      } catch (_) {}
    }

    function playNewOrderAlert() {
      unlockAudio();
      playBeep('new');
      hapticPing('new');
    }

    return {
      getSoundOn,
      setSoundOn,
      getSoundVolume,
      setSoundVolume,
      getAudioContext,
      unlockAudio,
      playBeep,
      hapticPing,
      playNewOrderAlert
    };
  }

  root.OrderBoardSound = { create: createOrderBoardSound };
})(typeof window !== 'undefined' ? window : global);
