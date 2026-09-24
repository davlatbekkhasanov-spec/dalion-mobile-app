/**
 * GlobusMarket intro — lightweight Three.js Earth.
 * Expects window.THREE and textures at /intro/earth-map.jpg (+ optional topo).
 */
(function (global) {
  'use strict';

  let renderer;
  let scene;
  let camera;
  let earth;
  let atmosphere;
  let clouds;
  let frameId = 0;
  let hostEl = null;
  let reducedMotion = false;
  let pointerX = 0;
  let pointerY = 0;
  let targetTiltX = 0.12;
  let targetTiltY = -0.35;
  let running = false;

  function preferReducedMotion() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function size() {
    if (!hostEl || !renderer || !camera) return;
    const w = Math.max(1, hostEl.clientWidth);
    const h = Math.max(1, hostEl.clientHeight);
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function onPointer(e) {
    if (!hostEl || reducedMotion) return;
    const rect = hostEl.getBoundingClientRect();
    const x = (('clientX' in e ? e.clientX : (e.touches && e.touches[0].clientX)) - rect.left) / rect.width;
    const y = (('clientY' in e ? e.clientY : (e.touches && e.touches[0].clientY)) - rect.top) / rect.height;
    pointerX = (x - 0.5) * 2;
    pointerY = (y - 0.5) * 2;
  }

  function animate() {
    if (!running) return;
    frameId = global.requestAnimationFrame(animate);
    if (earth) {
      if (!reducedMotion) earth.rotation.y += 0.0028;
      targetTiltX = 0.14 + pointerY * 0.12;
      targetTiltY = -0.32 + pointerX * 0.22;
      earth.rotation.x += (targetTiltX - earth.rotation.x) * 0.04;
      // keep base yaw spin; nudge group via parent if needed
    }
    if (clouds && !reducedMotion) clouds.rotation.y += 0.0034;
    if (atmosphere) {
      atmosphere.rotation.y = earth ? earth.rotation.y * 0.2 : 0;
    }
    renderer.render(scene, camera);
  }

  function dispose() {
    running = false;
    if (frameId) global.cancelAnimationFrame(frameId);
    frameId = 0;
    if (hostEl) {
      hostEl.removeEventListener('pointermove', onPointer);
      hostEl.removeEventListener('touchmove', onPointer);
    }
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
    clouds = null;
  }

  function start(host, options) {
    const THREE = global.THREE;
    if (!THREE || !host) return false;
    dispose();
    hostEl = host;
    reducedMotion = preferReducedMotion();
    const opts = options || {};

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0.05, 3.35);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace || THREE.sRGBEncoding;
    hostEl.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;';

    const ambient = new THREE.AmbientLight(0x6a86c8, 0.55);
    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(4.2, 2.2, 3.4);
    const fill = new THREE.DirectionalLight(0x6ec8ff, 0.45);
    fill.position.set(-3.2, -1.2, 2.2);
    scene.add(ambient, key, fill);

    const loader = new THREE.TextureLoader();
    const mapUrl = opts.mapUrl || '/intro/earth-map.jpg';
    const topoUrl = opts.topoUrl || '/intro/earth-topo.png';

    const earthGeo = new THREE.SphereGeometry(1, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.08
    });
    earth = new THREE.Mesh(earthGeo, earthMat);
    earth.rotation.x = 0.14;
    earth.rotation.y = -0.35;
    scene.add(earth);

    loader.load(mapUrl, function (tex) {
      if (tex.colorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
      else tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      earthMat.map = tex;
      earthMat.needsUpdate = true;
    });

    loader.load(topoUrl, function (tex) {
      earthMat.bumpMap = tex;
      earthMat.bumpScale = 0.035;
      earthMat.needsUpdate = true;
    }, undefined, function () { /* optional */ });

    // Soft cloud veil (reuses map with high opacity blue overlay via material color)
    const cloudGeo = new THREE.SphereGeometry(1.018, 48, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xddeeff,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      roughness: 1
    });
    clouds = new THREE.Mesh(cloudGeo, cloudMat);
    scene.add(clouds);

    // Atmosphere rim (back-side glow shell — not a big bubble)
    const atmGeo = new THREE.SphereGeometry(1.08, 48, 48);
    const atmMat = new THREE.MeshBasicMaterial({
      color: 0x5eb7ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
      depthWrite: false
    });
    atmosphere = new THREE.Mesh(atmGeo, atmMat);
    scene.add(atmosphere);

    size();
    hostEl.addEventListener('pointermove', onPointer, { passive: true });
    hostEl.addEventListener('touchmove', onPointer, { passive: true });
    global.addEventListener('resize', size, { passive: true });

    running = true;
    animate();
    hostEl.classList.add('is-3d');
    return true;
  }

  function stop() {
    if (hostEl) hostEl.classList.remove('is-3d');
    dispose();
    global.removeEventListener('resize', size);
  }

  global.GMIntroGlobe = {
    start: start,
    stop: stop,
    resize: size
  };
})(typeof window !== 'undefined' ? window : globalThis);
