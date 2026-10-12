// The AI core: a Three.js particle orb with orbit lines. Falls back to a CSS
// orb when WebGL or the CDN is unavailable. The clickable project rings are
// HTML buttons owned by main.js, so they stay accessible.

import { PROJECTS } from './content.js';

const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';
const BASE_COLOR = '#4fd1ff';
const AMP = { idle: 0.04, speaking: 0.16, focus: 0.08 };
const colorOf = (id) => PROJECTS.find((p) => p.id === id)?.color ?? BASE_COLOR;

const VERT = `
uniform float uTime;
uniform float uAmp;
uniform float uSize;
void main() {
  vec3 p = position;
  float n = sin(p.x * 3.0 + uTime * 1.4) * cos(p.y * 3.5 + uTime * 1.1) * sin(p.z * 3.0 + uTime * 0.8);
  p += normalize(p) * n * uAmp * 3.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (5.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, d) * 0.9);
}`;

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function mountCss(container) {
  container.replaceChildren();
  container.classList.add('core--css');
  const orb = document.createElement('div');
  orb.className = 'css-orb';
  orb.setAttribute('aria-hidden', 'true');
  container.append(orb);
  return {
    mode: 'css',
    setState(state) { orb.classList.toggle('is-speaking', state === 'speaking'); },
    focus(id) { orb.style.setProperty('--orb', colorOf(id)); },
  };
}

function mountGl(THREE, container, particles) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 6.5;

  // Even points on a sphere (Fibonacci lattice).
  const positions = new Float32Array(particles * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < particles; i++) {
    const y = 1 - (i / (particles - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    positions.set([Math.cos(theta) * r * 1.4, y * 1.4, Math.sin(theta) * r * 1.4], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: AMP.idle },
    uSize: { value: 3 * renderer.getPixelRatio() },
    uColor: { value: new THREE.Color(BASE_COLOR) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const orb = new THREE.Points(geometry, material);
  scene.add(orb);

  const ringMaterial = new THREE.MeshBasicMaterial({ color: BASE_COLOR, transparent: true, opacity: 0.3 });
  const rings = [2.1, 2.5, 2.9].map((radius, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.005, 6, 180), ringMaterial);
    ring.rotation.set(1.15 + i * 0.22, i * 0.7, 0);
    scene.add(ring);
    return ring;
  });

  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  let targetAmp = AMP.idle;
  const targetColor = new THREE.Color(BASE_COLOR);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    uniforms.uTime.value += dt;
    uniforms.uAmp.value += (targetAmp - uniforms.uAmp.value) * Math.min(1, dt * 4);
    uniforms.uColor.value.lerp(targetColor, Math.min(1, dt * 3));
    ringMaterial.color.lerp(targetColor, Math.min(1, dt * 3));
    orb.rotation.y += dt * 0.12;
    rings.forEach((ring, i) => { ring.rotation.z += dt * (0.05 + i * 0.03) * (i % 2 ? -1 : 1); });
    renderer.render(scene, camera);
  });

  return {
    mode: 'webgl',
    setState(state) { targetAmp = AMP[state] ?? AMP.idle; },
    focus(id) { targetColor.set(colorOf(id)); },
  };
}

export async function mountCore(container, { particles = 2400, forceCss = false, threeUrl = THREE_URL } = {}) {
  if (forceCss || !hasWebGL()) return mountCss(container);
  let THREE;
  try {
    THREE = await import(threeUrl);
  } catch {
    return mountCss(container);
  }
  try {
    return mountGl(THREE, container, particles);
  } catch {
    return mountCss(container);
  }
}
