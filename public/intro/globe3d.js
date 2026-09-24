/**
 * GlobusMarket intro — crisp Earth with free-hand drag spin.
 */
(function (global) {
  'use strict';

  let renderer;
  let scene;
  let camera;
  let earth;
  let atmosphere;
  let stars;
  let frameId = 0;
  let hostEl = null;
  let reducedMotion = false;
  let running = false;

  let dragging = false;
  let pointerId = null;
  let lastX = 0;
  let lastY = 0;
  let velY = 0;
  let velX = 0;
  let baseTiltX = 0.1;
  let autoSpin = 0.0032;
  let resumeTimer = 0;

  function preferReducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function size() {
    if (!hostEl || !renderer || !camera) return;
    const w = Math.max(1, hostEl.clientWidth);
    const h = Math.max(1, hostEl.clientHeight);
    const dpr = Math.min(global.devicePixelRatio || 1, 2.5);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setDragging(on) {
    dragging = on;
    if (hostEl) hostEl.classList.toggle('is-dragging', on);
  }

  function clearResume() {
    if (resumeTimer) {
      global.clearTimeout(resumeTimer);
      resumeTimer = 0;
    }
  }

  function eventPoint(e) {
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onPointerDown(e) {
    if (!hostEl || !earth) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    clearResume();
    setDragging(true);
    pointerId = e.pointerId;
    const p = eventPoint(e);
    lastX = p.x;
    lastY = p.y;
    velY = 0;
    velX = 0;
    try {
      hostEl.setPointerCapture(e.pointerId);
    } catch (_) {}
    if (e.cancelable) e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging || !earth) return;
    if (pointerId != null && e.pointerId !== pointerId) return;
    const p = eventPoint(e);
    const dx = p.x - lastX;
    const dy = p.y - lastY;
    lastX = p.x;
    lastY = p.y;
    // Horizontal drag spins longitude; vertical tilts latitude
    const spin = dx * 0.0055;
    const tilt = dy * 0.0042;
    earth.rotation.y += spin;
    earth.rotation.x = Math.max(-0.85, Math.min(0.85, earth.rotation.x + tilt));
    velY = spin;
    velX = tilt;
    if (e.cancelable) e.preventDefault();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    if (pointerId != null && e.pointerId !== pointerId) return;
    setDragging(false);
    pointerId = null;
    try {
      if (hostEl && e.pointerId != null) hostEl.releasePointerCapture(e.pointerId);
    } catch (_) {}
    // After flick settles, ease back toward gentle auto-spin
    clearResume();
    resumeTimer = global.setTimeout(function () {
      resumeTimer = 0;
      velY *= 0.35;
    }, 1600);
  }

  function animate() {
    if (!running) return;
    frameId = global.requestAnimationFrame(animate);
    if (earth) {
      if (dragging) {
        // rotation applied live in pointer handlers
      } else {
        // Inertia after flick
        if (Math.abs(velY) > 0.00008 || Math.abs(velX) > 0.00008) {
          earth.rotation.y += velY;
          earth.rotation.x = Math.max(-0.85, Math.min(0.85, earth.rotation.x + velX));
          velY *= 0.94;
          velX *= 0.9;
        } else if (!reducedMotion) {
          // Soft auto-spin when idle
          earth.rotation.y += autoSpin;
          earth.rotation.x += (baseTiltX - earth.rotation.x) * 0.02;
        }
      }
      earth.rotation.z *= 0.92;
    }
    if (atmosphere && earth) {
      atmosphere.rotation.y = earth.rotation.y;
      atmosphere.rotation.x = earth.rotation.x;
    }
    if (stars && !reducedMotion) stars.rotation.y -= 0.0003;
    renderer.render(scene, camera);
  }

  function unbindPointer() {
    if (!hostEl) return;
    hostEl.removeEventListener('pointerdown', onPointerDown);
    hostEl.removeEventListener('pointermove', onPointerMove);
    hostEl.removeEventListener('pointerup', onPointerUp);
    hostEl.removeEventListener('pointercancel', onPointerUp);
    hostEl.removeEventListener('lostpointercapture', onPointerUp);
  }

  function dispose() {
    running = false;
    if (frameId) global.cancelAnimationFrame(frameId);
    frameId = 0;
    clearResume();
    setDragging(false);
    unbindPointer();
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
    renderer = null;
    scene = null;
    camera = null;
    earth = null;
    atmosphere = null;
    stars = null;
    hostEl = null;
  }

  function makeStarField(THREE) {
    const count = 280;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const r = 5 + Math.random() * 8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const warm = Math.random();
      colors[i * 3] = 0.8 + warm * 0.2;
      colors[i * 3 + 1] = 0.88 + warm * 0.12;
      colors[i * 3 + 2] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.028,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true
    });
    return new THREE.Points(geo, mat);
  }

  function start(host, options) {
    const THREE = global.THREE;
    if (!THREE || !host) return false;
    dispose();
    hostEl = host;
    reducedMotion = preferReducedMotion();
    autoSpin = reducedMotion ? 0 : 0.0032;
    const opts = options || {};

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.02, 2.72);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'highp'
    });
    renderer.setClearColor(0x000000, 0);
    if (THREE.NoToneMapping != null) renderer.toneMapping = THREE.NoToneMapping;
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding != null) renderer.outputEncoding = THREE.sRGBEncoding;

    hostEl.appendChild(renderer.domElement);
    renderer.domElement.style.cssText =
      'width:100%;height:100%;display:block;touch-action:none;cursor:inherit;';

    scene.add(new THREE.AmbientLight(0xffffff, 1.55));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x243652, 0.7));

    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(4.2, 2.8, 3.6);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xc4ecff, 1.15);
    fill.position.set(-3.2, 0.2, 2.4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0x9ad8ff, 1.25);
    rim.position.set(-0.8, 1.2, -3.2);
    scene.add(rim);

    stars = makeStarField(THREE);
    scene.add(stars);

    const loader = new THREE.TextureLoader();
    const mapUrl = opts.mapUrl || '/intro/earth-map.jpg';
    const topoUrl = opts.topoUrl || '/intro/earth-topo.png';

    const earthGeo = new THREE.SphereGeometry(1, 96, 96);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 22,
      specular: 0x446688,
      emissive: 0x102038,
      emissiveIntensity: 0.28
    });
    earth = new THREE.Mesh(earthGeo, earthMat);
    earth.rotation.x = baseTiltX;
    earth.rotation.y = -0.55;
    scene.add(earth);

    loader.load(mapUrl, function (tex) {
      if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
      else if (THREE.sRGBEncoding != null) tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      earthMat.map = tex;
      earthMat.needsUpdate = true;
    });

    loader.load(topoUrl, function (tex) {
      earthMat.bumpMap = tex;
      earthMat.bumpScale = 0.028;
      earthMat.needsUpdate = true;
    }, undefined, function () {});

    const atmGeo = new THREE.SphereGeometry(1.018, 64, 64);
    const atmMat = new THREE.MeshBasicMaterial({
      color: 0xa8ddff,
      transparent: true,
      opacity: 0.14,
      side: THREE.BackSide,
      depthWrite: false
    });
    atmosphere = new THREE.Mesh(atmGeo, atmMat);
    scene.add(atmosphere);

    size();
    hostEl.style.touchAction = 'none';
    hostEl.style.cursor = 'grab';
    hostEl.setAttribute('aria-hidden', 'false');
    hostEl.setAttribute('role', 'img');
    hostEl.setAttribute('aria-label', 'Globus — barmoq bilan aylantiring');
    hostEl.addEventListener('pointerdown', onPointerDown, { passive: false });
    hostEl.addEventListener('pointermove', onPointerMove, { passive: false });
    hostEl.addEventListener('pointerup', onPointerUp, { passive: true });
    hostEl.addEventListener('pointercancel', onPointerUp, { passive: true });
    hostEl.addEventListener('lostpointercapture', onPointerUp, { passive: true });
    global.addEventListener('resize', size, { passive: true });

    running = true;
    animate();
    hostEl.classList.add('is-3d');
    if (hostEl.parentElement) hostEl.parentElement.classList.add('is-3d');
    return true;
  }

  function stop() {
    if (hostEl) {
      hostEl.classList.remove('is-3d', 'is-dragging');
      if (hostEl.parentElement) hostEl.parentElement.classList.remove('is-3d');
    }
    dispose();
    global.removeEventListener('resize', size);
  }

  global.GMIntroGlobe = {
    start: start,
    stop: stop,
    resize: size
  };
})(typeof window !== 'undefined' ? window : globalThis);
