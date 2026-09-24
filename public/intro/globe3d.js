/**
 * GlobusMarket intro — bright, crisp Three.js Earth.
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
  let pointerX = 0;
  let pointerY = 0;
  let targetTiltX = 0.1;
  let running = false;

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

  function onPointer(e) {
    if (!hostEl || reducedMotion) return;
    const rect = hostEl.getBoundingClientRect();
    const cx = 'clientX' in e ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX);
    const cy = 'clientY' in e ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY);
    if (cx == null) return;
    pointerX = ((cx - rect.left) / rect.width - 0.5) * 2;
    pointerY = ((cy - rect.top) / rect.height - 0.5) * 2;
  }

  function animate() {
    if (!running) return;
    frameId = global.requestAnimationFrame(animate);
    if (earth) {
      if (!reducedMotion) earth.rotation.y += 0.0032;
      targetTiltX = 0.12 + pointerY * 0.1;
      earth.rotation.x += (targetTiltX - earth.rotation.x) * 0.05;
      earth.rotation.z += ((pointerX * 0.08) - earth.rotation.z) * 0.04;
    }
    if (atmosphere && earth) atmosphere.rotation.y = earth.rotation.y * 0.15;
    if (stars && !reducedMotion) stars.rotation.y -= 0.00035;
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
    stars = null;
  }

  function makeStarField(THREE) {
    const count = 420;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const r = 4.5 + Math.random() * 7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      const warm = Math.random();
      colors[i * 3] = 0.75 + warm * 0.25;
      colors[i * 3 + 1] = 0.82 + warm * 0.18;
      colors[i * 3 + 2] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
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
    const opts = options || {};

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.02, 2.85);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'highp'
    });
    renderer.setClearColor(0x000000, 0);
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding != null) renderer.outputEncoding = THREE.sRGBEncoding;
    if (THREE.ACESFilmicToneMapping != null) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.65;
    }
    hostEl.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;border-radius:50%;';

    // Bright studio-like lighting so continents pop
    scene.add(new THREE.AmbientLight(0xffffff, 1.05));
    scene.add(new THREE.HemisphereLight(0xb8d8ff, 0x0a1830, 0.85));

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3.8, 2.6, 4.2);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x8fd9ff, 1.1);
    fill.position.set(-3.5, 0.4, 2.8);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0x66ccff, 1.35);
    rim.position.set(-1.2, 1.5, -3.5);
    scene.add(rim);

    stars = makeStarField(THREE);
    scene.add(stars);

    const loader = new THREE.TextureLoader();
    const mapUrl = opts.mapUrl || '/intro/earth-map.jpg';
    const topoUrl = opts.topoUrl || '/intro/earth-topo.png';

    const earthGeo = new THREE.SphereGeometry(1, 96, 96);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.04,
      emissive: 0x143050,
      emissiveIntensity: 0.42
    });
    earth = new THREE.Mesh(earthGeo, earthMat);
    earth.rotation.x = 0.12;
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
      earthMat.emissiveMap = tex;
      earthMat.needsUpdate = true;
    });

    loader.load(topoUrl, function (tex) {
      earthMat.bumpMap = tex;
      earthMat.bumpScale = 0.045;
      earthMat.needsUpdate = true;
    }, undefined, function () {});

    // Crisp cyan atmosphere rim (thin, bright — not a foggy bubble)
    const atmGeo = new THREE.SphereGeometry(1.045, 64, 64);
    const atmMat = new THREE.MeshBasicMaterial({
      color: 0x7ed0ff,
      transparent: true,
      opacity: 0.32,
      side: THREE.BackSide,
      depthWrite: false
    });
    atmosphere = new THREE.Mesh(atmGeo, atmMat);
    scene.add(atmosphere);

    // Outer soft halo
    const haloGeo = new THREE.SphereGeometry(1.12, 48, 48);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x4aa8ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      depthWrite: false
    });
    scene.add(new THREE.Mesh(haloGeo, haloMat));

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
