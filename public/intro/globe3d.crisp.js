/**
 * GlobusMarket intro — crisp, bright Three.js Earth (no haze).
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
      if (!reducedMotion) earth.rotation.y += 0.003;
      targetTiltX = 0.1 + pointerY * 0.08;
      earth.rotation.x += (targetTiltX - earth.rotation.x) * 0.05;
      earth.rotation.z += ((pointerX * 0.06) - earth.rotation.z) * 0.04;
    }
    if (atmosphere && earth) atmosphere.rotation.y = earth.rotation.y * 0.12;
    if (stars && !reducedMotion) stars.rotation.y -= 0.0003;
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
    // Keep colors crisp — ACES was muting/hazing the Earth
    if (THREE.NoToneMapping != null) renderer.toneMapping = THREE.NoToneMapping;
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding != null) renderer.outputEncoding = THREE.sRGBEncoding;

    hostEl.appendChild(renderer.domElement);
    renderer.domElement.style.cssText =
      'width:100%;height:100%;display:block;touch-action:none;';

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
    // MeshPhong keeps specular highlight and stays vivid without muddy PBR haze
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shininess: 22,
      specular: 0x446688,
      emissive: 0x102038,
      emissiveIntensity: 0.28
    });
    earth = new THREE.Mesh(earthGeo, earthMat);
    earth.rotation.x = 0.1;
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

    // Hairline atmosphere rim only — no foggy outer shell
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
