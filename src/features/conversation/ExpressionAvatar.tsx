import { useEffect, useRef, type ReactNode } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { Expression } from '../../shared/contracts';

export interface ExpressionAvatarProps {
  expression: Expression | null;
  active: boolean;
  reduced?: boolean;
  replay?: number;
  audioVolume?: number;
  lowPower?: boolean;
  fallback?: ReactNode;
  onUnavailable?: () => void;
  onReady?: () => void;
}

export interface SphereFaceProfile {
  readonly colors: {
    readonly top: string;
    readonly mid: string;
    readonly shadow: string;
    readonly rim: string;
    readonly cheek: string;
    readonly aura: string;
  };
  readonly cheekOpacity: number;
  readonly eyeWidth: number;
  readonly eyeHeight: number;
  readonly eyeTilt: number;
  readonly eyeOffsetY: number;
  readonly browInnerY: number;
  readonly browMidY: number;
  readonly browOuterY: number;
  readonly browInward: number;
  readonly browRightDeltaY: number;
  readonly mouthWidth: number;
  readonly mouthBaseY: number;
  readonly mouthCornerY: number;
  readonly mouthUpperY: number;
  readonly mouthLowerY: number;
  readonly mouthAsym: number;
  readonly headPitch: number;
  readonly headYaw: number;
  readonly headRoll: number;
  readonly bobSpeed: number;
  readonly bobAmp: number;
}

/**
 * 7 Calibrated 3D Emoji / Pixar Sphere Character Profiles.
 * Designed for instant Deaf-first visual recognition from a glance.
 */
export const orbEmotionProfiles: Record<Expression, SphereFaceProfile> = {
  happy: {
    colors: {
      top: '#FEF08A',
      mid: '#FBBF24',
      shadow: '#D97706',
      rim: '#FEF9C3',
      cheek: '#FB7185',
      aura: '#F59E0B',
    },
    cheekOpacity: 0.56,
    eyeWidth: 1.08,
    eyeHeight: 0.82,
    eyeTilt: -0.1,
    eyeOffsetY: 0.025,
    browInnerY: 0.36,
    browMidY: 0.44,
    browOuterY: 0.36,
    browInward: 0.0,
    browRightDeltaY: 0.0,
    mouthWidth: 0.28,
    mouthBaseY: -0.18,
    mouthCornerY: 0.09,
    mouthUpperY: 0.04,
    mouthLowerY: -0.16,
    mouthAsym: 0.0,
    headPitch: -0.05,
    headYaw: 0.0,
    headRoll: 0.06,
    bobSpeed: 2.8,
    bobAmp: 0.036,
  },
  sad: {
    colors: {
      top: '#BAE6FD',
      mid: '#60A5FA',
      shadow: '#1D4ED8',
      rim: '#E0F2FE',
      cheek: '#818CF8',
      aura: '#3B82F6',
    },
    cheekOpacity: 0.2,
    eyeWidth: 0.98,
    eyeHeight: 0.88,
    eyeTilt: 0.14,
    eyeOffsetY: -0.02,
    browInnerY: 0.41,
    browMidY: 0.35,
    browOuterY: 0.25,
    browInward: 0.02,
    browRightDeltaY: 0.0,
    mouthWidth: 0.2,
    mouthBaseY: -0.23,
    mouthCornerY: -0.08,
    mouthUpperY: 0.03,
    mouthLowerY: 0.03,
    mouthAsym: 0.0,
    headPitch: 0.16,
    headYaw: -0.04,
    headRoll: -0.08,
    bobSpeed: 1.3,
    bobAmp: 0.018,
  },
  angry: {
    colors: {
      top: '#FCA5A5',
      mid: '#EF4444',
      shadow: '#991B1B',
      rim: '#FECACA',
      cheek: '#DC2626',
      aura: '#EF4444',
    },
    cheekOpacity: 0.35,
    eyeWidth: 1.06,
    eyeHeight: 0.78,
    eyeTilt: -0.18,
    eyeOffsetY: -0.01,
    browInnerY: 0.23,
    browMidY: 0.29,
    browOuterY: 0.39,
    browInward: 0.055,
    browRightDeltaY: 0.0,
    mouthWidth: 0.22,
    mouthBaseY: -0.22,
    mouthCornerY: -0.07,
    mouthUpperY: 0.02,
    mouthLowerY: -0.01,
    mouthAsym: 0.02,
    headPitch: 0.1,
    headYaw: 0.0,
    headRoll: 0.0,
    bobSpeed: 3.4,
    bobAmp: 0.02,
  },
  surprised: {
    colors: {
      top: '#F5D0FE',
      mid: '#E879F9',
      shadow: '#86198F',
      rim: '#FAE8FF',
      cheek: '#F472B6',
      aura: '#D946EF',
    },
    cheekOpacity: 0.42,
    eyeWidth: 1.22,
    eyeHeight: 1.28,
    eyeTilt: 0.0,
    eyeOffsetY: 0.03,
    browInnerY: 0.43,
    browMidY: 0.51,
    browOuterY: 0.42,
    browInward: -0.01,
    browRightDeltaY: 0.0,
    mouthWidth: 0.125,
    mouthBaseY: -0.22,
    mouthCornerY: 0.0,
    mouthUpperY: 0.11,
    mouthLowerY: -0.12,
    mouthAsym: 0.0,
    headPitch: -0.08,
    headYaw: 0.0,
    headRoll: 0.0,
    bobSpeed: 2.4,
    bobAmp: 0.03,
  },
  fear: {
    colors: {
      top: '#DDD6FE',
      mid: '#A78BFA',
      shadow: '#4C1D95',
      rim: '#EDE9FE',
      cheek: '#8B5CF6',
      aura: '#7C3AED',
    },
    cheekOpacity: 0.22,
    eyeWidth: 1.15,
    eyeHeight: 1.2,
    eyeTilt: 0.12,
    eyeOffsetY: 0.015,
    browInnerY: 0.43,
    browMidY: 0.39,
    browOuterY: 0.3,
    browInward: 0.03,
    browRightDeltaY: 0.0,
    mouthWidth: 0.18,
    mouthBaseY: -0.23,
    mouthCornerY: -0.04,
    mouthUpperY: 0.06,
    mouthLowerY: -0.07,
    mouthAsym: 0.0,
    headPitch: 0.04,
    headYaw: 0.0,
    headRoll: -0.04,
    bobSpeed: 3.8,
    bobAmp: 0.016,
  },
  disgust: {
    colors: {
      top: '#ECFCCB',
      mid: '#A3E635',
      shadow: '#3F6212',
      rim: '#F7FEE7',
      cheek: '#65A30D',
      aura: '#84CC16',
    },
    cheekOpacity: 0.24,
    eyeWidth: 1.0,
    eyeHeight: 0.74,
    eyeTilt: -0.06,
    eyeOffsetY: 0.0,
    browInnerY: 0.27,
    browMidY: 0.32,
    browOuterY: 0.33,
    browInward: 0.03,
    browRightDeltaY: 0.075,
    mouthWidth: 0.21,
    mouthBaseY: -0.21,
    mouthCornerY: -0.04,
    mouthUpperY: 0.03,
    mouthLowerY: 0.03,
    mouthAsym: 0.055,
    headPitch: 0.03,
    headYaw: -0.12,
    headRoll: 0.07,
    bobSpeed: 1.7,
    bobAmp: 0.02,
  },
  neutral: {
    colors: {
      top: '#A7F3D0',
      mid: '#34D399',
      shadow: '#047857',
      rim: '#D1FAE5',
      cheek: '#FB7185',
      aura: '#10B981',
    },
    cheekOpacity: 0.22,
    eyeWidth: 1.0,
    eyeHeight: 1.0,
    eyeTilt: 0.0,
    eyeOffsetY: 0.0,
    browInnerY: 0.33,
    browMidY: 0.37,
    browOuterY: 0.32,
    browInward: 0.0,
    browRightDeltaY: 0.0,
    mouthWidth: 0.19,
    mouthBaseY: -0.2,
    mouthCornerY: 0.035,
    mouthUpperY: -0.01,
    mouthLowerY: -0.01,
    mouthAsym: 0.0,
    headPitch: 0.0,
    headYaw: 0.0,
    headRoll: 0.0,
    bobSpeed: 1.8,
    bobAmp: 0.024,
  },
};

// ============================================================================
// Custom Shaders: Pixar Satin-Subsurface Sphere, Glossy Feature & Soft Halo
// ============================================================================

const headVertexShader = `
precision mediump float;
varying vec3 vLocalNormal;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vLocalNormal = normalize(normal);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const headFragmentShader = `
precision mediump float;
uniform vec3 uColorTop;
uniform vec3 uColorMid;
uniform vec3 uColorShadow;
uniform vec3 uColorRim;
uniform vec3 uColorCheek;
uniform float uCheekOpacity;
uniform float uAudioGlow;

varying vec3 vLocalNormal;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 LN = normalize(vLocalNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);

  // Studio 3-point soft subsurface wrap lighting (Pixar vinyl/satin finish)
  vec3 keyDir = normalize(vec3(-0.48, 0.72, 0.88));
  float halfLambert = dot(N, keyDir) * 0.5 + 0.5;
  float wrap = smoothstep(0.08, 0.96, halfLambert);

  vec3 base = mix(uColorShadow, uColorMid, smoothstep(0.0, 0.62, wrap));
  base = mix(base, uColorTop, smoothstep(0.55, 1.0, wrap));

  // Airbrushed 3D Rosy Cheek Blush anchored in head local space
  vec3 leftCheekDir = normalize(vec3(-0.46, -0.08, 0.76));
  vec3 rightCheekDir = normalize(vec3(0.46, -0.08, 0.76));
  float blushL = smoothstep(0.84, 0.985, dot(LN, leftCheekDir));
  float blushR = smoothstep(0.84, 0.985, dot(LN, rightCheekDir));
  float blush = max(blushL, blushR) * uCheekOpacity;
  base = mix(base, uColorCheek, blush);

  // Soft glossy dual-lobe studio highlight
  vec3 H = normalize(keyDir + V);
  float NdotH = max(dot(N, H), 0.0);
  float specTight = pow(NdotH, 42.0) * 0.38;
  float specBroad = pow(NdotH, 9.0) * 0.12;
  vec3 specular = vec3(1.0, 0.99, 0.96) * (specTight + specBroad);

  // Velvet Fresnel rim light + acoustic voice glow
  float NdotV = max(dot(N, V), 0.0);
  float fresnel = pow(1.0 - NdotV, 2.9);
  vec3 rim = uColorRim * fresnel * (0.72 + uAudioGlow * 0.45);

  vec3 color = base + specular + rim;
  gl_FragColor = vec4(color, 1.0);
}
`;

const featureVertexShader = `
precision mediump float;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const featureFragmentShader = `
precision mediump float;
uniform vec3 uBaseColor;
uniform vec3 uSheenColor;
uniform float uShininess;
uniform float uSpecStrength;

varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(vec3(-0.42, 0.75, 0.95));
  vec3 H = normalize(L + V);

  float diff = dot(N, L) * 0.5 + 0.5;
  vec3 col = mix(uBaseColor * 0.72, uBaseColor * 1.18, diff);

  float spec = pow(max(dot(N, H), 0.0), uShininess) * uSpecStrength;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5) * 0.22;
  col += uSheenColor * (spec + rim);

  gl_FragColor = vec4(col, 1.0);
}
`;

const auraVertexShader = `
precision mediump float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const auraFragmentShader = `
precision mediump float;
uniform vec3 uAuraColor;
uniform float uIntensity;
uniform float uPulsePhase;
uniform float uPulseAmp;
varying vec2 vUv;

void main() {
  vec2 centered = (vUv - 0.5) * 2.0;
  float r = length(centered);
  float glow = pow(max(0.0, 1.0 - r), 2.4) * uIntensity;
  float ring = smoothstep(0.14, 0.0, abs(r - uPulsePhase)) * uPulseAmp * (1.0 - smoothstep(0.7, 1.0, r));
  float alpha = clamp(glow + ring, 0.0, 0.85);
  gl_FragColor = vec4(uAuraColor, alpha);
}
`;

// ============================================================================
// Zero-Allocation 3D Curved Tube & Mouth Geometry Updaters
// ============================================================================

function createTubeBuffer(rings: number, radial: number, closedLoop = false): BufferGeometry {
  const ringCount = closedLoop ? rings : rings;
  const vertCount = ringCount * radial;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const indices: number[] = [];

  const segs = closedLoop ? ringCount : ringCount - 1;
  for (let i = 0; i < segs; i++) {
    const nextI = (i + 1) % ringCount;
    for (let j = 0; j < radial; j++) {
      const nextJ = (j + 1) % radial;
      const a = i * radial + j;
      const b = nextI * radial + j;
      const c = nextI * radial + nextJ;
      const d = i * radial + nextJ;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setAttribute('normal', new BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

const tmpP = new Vector3();
const tmpNext = new Vector3();
const tmpPrev = new Vector3();
const tmpTangent = new Vector3();
const tmpNormal = new Vector3();
const tmpBinormal = new Vector3();

function projectToSphere(x: number, y: number, radius: number, out: Vector3): Vector3 {
  const r2 = x * x + y * y;
  const maxR2 = radius * radius * 0.88;
  const clampedScale = r2 > maxR2 ? Math.sqrt(maxR2 / r2) : 1;
  const sx = x * clampedScale;
  const sy = y * clampedScale;
  const sz = Math.sqrt(Math.max(0.01, radius * radius - sx * sx - sy * sy));
  return out.set(sx, sy, sz);
}

function updateQuadraticTube(
  geo: BufferGeometry,
  rings: number,
  radial: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  sphereRadius: number,
  tubeRadius: number,
) {
  const posAttr = geo.getAttribute('position') as BufferAttribute;
  const normAttr = geo.getAttribute('normal') as BufferAttribute;
  const posArr = posAttr.array as Float32Array;
  const normArr = normAttr.array as Float32Array;

  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const inv = 1 - t;
    const bx = inv * inv * x0 + 2 * inv * t * x1 + t * t * x2;
    const by = inv * inv * y0 + 2 * inv * t * y1 + t * t * y2;
    projectToSphere(bx, by, sphereRadius, tmpP);

    const tPrev = Math.max(0, t - 0.04);
    const tNext = Math.min(1, t + 0.04);
    const invP = 1 - tPrev;
    const invN = 1 - tNext;
    projectToSphere(
      invP * invP * x0 + 2 * invP * tPrev * x1 + tPrev * tPrev * x2,
      invP * invP * y0 + 2 * invP * tPrev * y1 + tPrev * tPrev * y2,
      sphereRadius,
      tmpPrev,
    );
    projectToSphere(
      invN * invN * x0 + 2 * invN * tNext * x1 + tNext * tNext * x2,
      invN * invN * y0 + 2 * invN * tNext * y1 + tNext * tNext * y2,
      sphereRadius,
      tmpNext,
    );

    tmpTangent.subVectors(tmpNext, tmpPrev).normalize();
    tmpNormal.copy(tmpP).normalize();
    tmpBinormal.crossVectors(tmpTangent, tmpNormal).normalize();
    tmpNormal.crossVectors(tmpBinormal, tmpTangent).normalize();

    // Smooth capsule taper at both tips
    const taper = Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, t))), 0.38);
    const r = tubeRadius * taper;

    for (let j = 0; j < radial; j++) {
      const theta = (j / radial) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const nx = tmpNormal.x * cosT + tmpBinormal.x * sinT;
      const ny = tmpNormal.y * cosT + tmpBinormal.y * sinT;
      const nz = tmpNormal.z * cosT + tmpBinormal.z * sinT;

      const idx = (i * radial + j) * 3;
      posArr[idx] = tmpP.x + nx * r;
      posArr[idx + 1] = tmpP.y + ny * r;
      posArr[idx + 2] = tmpP.z + nz * r;
      normArr[idx] = nx;
      normArr[idx + 1] = ny;
      normArr[idx + 2] = nz;
    }
  }

  posAttr.needsUpdate = true;
  normAttr.needsUpdate = true;
}

function createMouthCavityBuffer(cols: number): BufferGeometry {
  // 2 rows (upper lip curve & lower lip curve) x cols points
  const positions = new Float32Array(cols * 2 * 3);
  const indices: number[] = [];
  for (let i = 0; i < cols - 1; i++) {
    const u0 = i;
    const u1 = i + 1;
    const l0 = cols + i;
    const l1 = cols + i + 1;
    indices.push(u0, l0, u1, u1, l0, l1);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

function updateMouthGeometries(
  upperLipGeo: BufferGeometry,
  lowerLipGeo: BufferGeometry,
  cavityGeo: BufferGeometry,
  rings: number,
  radial: number,
  width: number,
  baseY: number,
  cornerY: number,
  upperMidY: number,
  lowerMidY: number,
  asym: number,
  lipRadius: number,
) {
  const xL = -width;
  const yL = baseY + cornerY - asym * 0.45;
  const xR = width;
  const yR = baseY + cornerY + asym * 0.45;

  const ctrlUpperY = baseY + upperMidY;
  const ctrlLowerY = baseY + lowerMidY;

  updateQuadraticTube(
    upperLipGeo,
    rings,
    radial,
    xL,
    yL,
    0,
    ctrlUpperY,
    xR,
    yR,
    0.884,
    lipRadius,
  );

  updateQuadraticTube(
    lowerLipGeo,
    rings,
    radial,
    xL,
    yL,
    0,
    ctrlLowerY,
    xR,
    yR,
    0.884,
    lipRadius,
  );

  const cavPos = cavityGeo.getAttribute('position') as BufferAttribute;
  const cavArr = cavPos.array as Float32Array;
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const inv = 1 - t;
    const ux = inv * inv * xL + t * t * xR;
    const uy = inv * inv * yL + 2 * inv * t * ctrlUpperY + t * t * yR;
    projectToSphere(ux, uy, 0.872, tmpP);
    const uIdx = i * 3;
    cavArr[uIdx] = tmpP.x;
    cavArr[uIdx + 1] = tmpP.y;
    cavArr[uIdx + 2] = tmpP.z;

    const ly = inv * inv * yL + 2 * inv * t * ctrlLowerY + t * t * yR;
    projectToSphere(ux, ly, 0.872, tmpP);
    const lIdx = (rings + i) * 3;
    cavArr[lIdx] = tmpP.x;
    cavArr[lIdx + 1] = tmpP.y;
    cavArr[lIdx + 2] = tmpP.z;
  }
  cavPos.needsUpdate = true;
}

// ============================================================================
// React Component: 3D Pixar / Emoji Sphere Face Character
// ============================================================================

export default function ExpressionAvatar({
  expression,
  active,
  reduced = false,
  replay = 0,
  audioVolume = 0,
  lowPower = false,
  onUnavailable,
  onReady,
}: ExpressionAvatarProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({
    expression,
    active,
    reduced,
    audioVolume,
    lowPower,
    onUnavailable,
    onReady,
  });
  latest.current = {
    expression,
    active,
    reduced,
    audioVolume,
    lowPower,
    onUnavailable,
    onReady,
  };

  const triggerBounce = useRef<(() => void) | null>(null);
  const renderSingle = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!active || !host.current) return;

    const container = host.current;
    let renderer: WebGLRenderer | null = null;
    let frame = 0;
    let disposed = false;
    let tick: ((now: number) => void) | null = null;

    const geometries: BufferGeometry[] = [];
    const materials: (ShaderMaterial | MeshBasicMaterial)[] = [];

    // Pre-cached Color palette map (zero allocation in RAF)
    const colorCache = new Map<string, Color>();
    const getCachedColor = (hex: string) => {
      let c = colorCache.get(hex);
      if (!c) {
        c = new Color(hex);
        colorCache.set(hex, c);
      }
      return c;
    };
    Object.values(orbEmotionProfiles).forEach((p) => {
      Object.values(p.colors).forEach(getCachedColor);
    });

    let pointerX = 0;
    let pointerY = 0;
    let smoothedPointerX = 0;
    let smoothedPointerY = 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointerY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      }
    };

    const onPointerLeave = () => {
      pointerX = 0;
      pointerY = 0;
    };

    let onContextLost: ((e: Event) => void) | null = null;

    const release = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      frame = 0;
      triggerBounce.current = null;
      renderSingle.current = null;
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      if (renderer && onContextLost) {
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      }
      try {
        renderer?.forceContextLoss?.();
      } catch {
        // Ignore if lose_context extension is unavailable in test/headless environments
      }
      renderer?.dispose();
      renderer?.domElement.remove();
      renderer = null;
    };

    const fail = () => {
      if (disposed) return;
      release();
      latest.current.onUnavailable?.();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else if (!disposed && renderer && tick && !frame && !latest.current.reduced) {
        frame = requestAnimationFrame(tick);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', release);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);

    try {
      const scene = new Scene();
      const camera = new PerspectiveCamera(32, 1, 0.1, 20);
      camera.position.set(0, 0.02, 3.85);
      camera.lookAt(0, 0, 0);

      const initialKey: Expression = latest.current.expression ?? 'neutral';
      const initProf = orbEmotionProfiles[initialKey];

      // 1. Soft Backlight Aura Halo Disc
      const auraGeo = new PlaneGeometry(2.35, 2.35);
      geometries.push(auraGeo);
      const currAuraColor = getCachedColor(initProf.colors.aura).clone();
      const auraMat = new ShaderMaterial({
        vertexShader: auraVertexShader,
        fragmentShader: auraFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        uniforms: {
          uAuraColor: { value: currAuraColor },
          uIntensity: { value: 0.42 },
          uPulsePhase: { value: 0.0 },
          uPulseAmp: { value: 0.0 },
        },
      });
      materials.push(auraMat);
      const auraMesh = new Mesh(auraGeo, auraMat);
      auraMesh.position.set(0, 0, -0.58);
      scene.add(auraMesh);

      // 2. Character Head Rig Group
      const headGroup = new Group();
      scene.add(headGroup);

      const currTop = getCachedColor(initProf.colors.top).clone();
      const currMid = getCachedColor(initProf.colors.mid).clone();
      const currShadow = getCachedColor(initProf.colors.shadow).clone();
      const currRim = getCachedColor(initProf.colors.rim).clone();
      const currCheek = getCachedColor(initProf.colors.cheek).clone();

      const headGeo = new SphereGeometry(0.86, 48, 48);
      geometries.push(headGeo);
      const headMat = new ShaderMaterial({
        vertexShader: headVertexShader,
        fragmentShader: headFragmentShader,
        uniforms: {
          uColorTop: { value: currTop },
          uColorMid: { value: currMid },
          uColorShadow: { value: currShadow },
          uColorRim: { value: currRim },
          uColorCheek: { value: currCheek },
          uCheekOpacity: { value: initProf.cheekOpacity },
          uAudioGlow: { value: 0.0 },
        },
      });
      materials.push(headMat);
      const headMesh = new Mesh(headGeo, headMat);
      headGroup.add(headMesh);

      // Shared Glossy Espresso Material for Eyes, Brows & Lip Contours
      const darkFeatureMat = new ShaderMaterial({
        vertexShader: featureVertexShader,
        fragmentShader: featureFragmentShader,
        uniforms: {
          uBaseColor: { value: new Color('#1a1025') },
          uSheenColor: { value: new Color('#fff7ed') },
          uShininess: { value: 48.0 },
          uSpecStrength: { value: 0.55 },
        },
      });
      materials.push(darkFeatureMat);

      const catchlightMat = new MeshBasicMaterial({ color: '#ffffff' });
      materials.push(catchlightMat);

      // 3. Left & Right Expressive 3D Eyes with Dual Pixar Catchlights
      const eyeSphereGeo = new SphereGeometry(0.108, 28, 28);
      const catchMainGeo = new SphereGeometry(0.032, 14, 14);
      const catchSubGeo = new SphereGeometry(0.015, 10, 10);
      geometries.push(eyeSphereGeo, catchMainGeo, catchSubGeo);

      const createEyeRig = (side: -1 | 1) => {
        const anchor = new Group();
        anchor.position.set(side * 0.27, 0.115, 0.812);
        anchor.rotation.y = side * 0.31;
        anchor.rotation.x = -0.12;

        const body = new Mesh(eyeSphereGeo, darkFeatureMat);
        body.scale.set(1, 1, 0.46);
        anchor.add(body);

        const sparkles = new Group();
        const mainSparkle = new Mesh(catchMainGeo, catchlightMat);
        mainSparkle.position.set(-0.03, 0.035, 0.052);
        mainSparkle.scale.set(1, 1, 0.5);
        const subSparkle = new Mesh(catchSubGeo, catchlightMat);
        subSparkle.position.set(0.028, -0.028, 0.05);
        subSparkle.scale.set(1, 1, 0.5);
        sparkles.add(mainSparkle, subSparkle);
        anchor.add(sparkles);

        headGroup.add(anchor);
        return { anchor, body, sparkles };
      };

      const leftEye = createEyeRig(-1);
      const rightEye = createEyeRig(1);

      // 4. Sculpted 3D Curved Eyebrows
      const BROW_RINGS = 11;
      const BROW_RADIAL = 9;
      const leftBrowGeo = createTubeBuffer(BROW_RINGS, BROW_RADIAL);
      const rightBrowGeo = createTubeBuffer(BROW_RINGS, BROW_RADIAL);
      geometries.push(leftBrowGeo, rightBrowGeo);

      const leftBrowMesh = new Mesh(leftBrowGeo, darkFeatureMat);
      const rightBrowMesh = new Mesh(rightBrowGeo, darkFeatureMat);
      headGroup.add(leftBrowMesh, rightBrowMesh);

      // 5. Sculpted 3D Expressive Mouth (Upper Lip + Lower Lip + Velvet Cavity + Coral Tongue)
      const MOUTH_RINGS = 13;
      const MOUTH_RADIAL = 9;
      const upperLipGeo = createTubeBuffer(MOUTH_RINGS, MOUTH_RADIAL);
      const lowerLipGeo = createTubeBuffer(MOUTH_RINGS, MOUTH_RADIAL);
      const mouthCavityGeo = createMouthCavityBuffer(MOUTH_RINGS);
      const tongueGeo = new SphereGeometry(0.075, 18, 14);
      geometries.push(upperLipGeo, lowerLipGeo, mouthCavityGeo, tongueGeo);

      const cavityMat = new MeshBasicMaterial({ color: '#450a1f', side: DoubleSide });
      const tongueMat = new ShaderMaterial({
        vertexShader: featureVertexShader,
        fragmentShader: featureFragmentShader,
        uniforms: {
          uBaseColor: { value: new Color('#fb7185') },
          uSheenColor: { value: new Color('#ffe4e6') },
          uShininess: { value: 24.0 },
          uSpecStrength: { value: 0.28 },
        },
      });
      materials.push(cavityMat, tongueMat);

      const upperLipMesh = new Mesh(upperLipGeo, darkFeatureMat);
      const lowerLipMesh = new Mesh(lowerLipGeo, darkFeatureMat);
      const mouthCavityMesh = new Mesh(mouthCavityGeo, cavityMat);
      const tongueMesh = new Mesh(tongueGeo, tongueMat);
      tongueMesh.scale.set(1.25, 0.55, 0.35);
      headGroup.add(mouthCavityMesh, tongueMesh, upperLipMesh, lowerLipMesh);

      // WebGLRenderer Setup (strict 180x180 logical contract + 1:1 inline containment)
      renderer = new WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'default',
      });
      renderer.setClearColor?.(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(180, 180, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.aspectRatio = '1 / 1';
      renderer.domElement.style.objectFit = 'contain';
      renderer.domElement.style.display = 'block';

      onContextLost = (e: Event) => {
        e.preventDefault();
        fail();
      };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);

      container.replaceChildren(renderer.domElement);

      // Interpolated Rig State
      const state = {
        cheekOpacity: initProf.cheekOpacity,
        eyeWidth: initProf.eyeWidth,
        eyeHeight: initProf.eyeHeight,
        eyeTilt: initProf.eyeTilt,
        eyeOffsetY: initProf.eyeOffsetY,
        browInnerY: initProf.browInnerY,
        browMidY: initProf.browMidY,
        browOuterY: initProf.browOuterY,
        browInward: initProf.browInward,
        browRightDeltaY: initProf.browRightDeltaY,
        mouthWidth: initProf.mouthWidth,
        mouthBaseY: initProf.mouthBaseY,
        mouthCornerY: initProf.mouthCornerY,
        mouthUpperY: initProf.mouthUpperY,
        mouthLowerY: initProf.mouthLowerY,
        mouthAsym: initProf.mouthAsym,
        headPitch: initProf.headPitch,
        headYaw: initProf.headYaw,
        headRoll: initProf.headRoll,
        bobSpeed: initProf.bobSpeed,
        bobAmp: initProf.bobAmp,
      };

      let smoothedAudio = 0;
      let scaleSpring = 1.0;
      let scaleVel = 0.0;
      let pulsePhase = 0.0;
      let pulseAmp = 0.0;
      let prevExpr: Expression = initialKey;

      // Natural Blinking Timer
      let nextBlinkAt = 1.8 + Math.random() * 2.2;
      let blinkElapsed = -1;
      const BLINK_DURATION = 0.15;

      triggerBounce.current = () => {
        scaleVel = 2.35;
        pulsePhase = 0.36;
        pulseAmp = 0.55;
      };

      const applyRigGeometry = (blinkScale: number, voiceOpen: number, elapsedSec: number) => {
        // Update Eyes
        const ew = state.eyeWidth;
        const eh = Math.max(0.08, state.eyeHeight * blinkScale);
        leftEye.anchor.position.y = 0.115 + state.eyeOffsetY;
        rightEye.anchor.position.y = 0.115 + state.eyeOffsetY;
        leftEye.anchor.rotation.z = state.eyeTilt;
        rightEye.anchor.rotation.z = -state.eyeTilt;
        leftEye.body.scale.set(ew, eh, 0.46);
        rightEye.body.scale.set(ew, eh, 0.46);
        const showSparkles = blinkScale > 0.32;
        leftEye.sparkles.visible = showSparkles;
        rightEye.sparkles.visible = showSparkles;
        leftEye.sparkles.position.y = (eh - 1) * 0.025;
        rightEye.sparkles.position.y = (eh - 1) * 0.025;

        // Update 3D Curved Eyebrows
        const inX = 0.125 - state.browInward;
        const midX = 0.285 - state.browInward * 0.5;
        const outX = 0.445;

        updateQuadraticTube(
          leftBrowGeo,
          BROW_RINGS,
          BROW_RADIAL,
          -inX,
          state.browInnerY,
          -midX,
          state.browMidY,
          -outX,
          state.browOuterY,
          0.89,
          0.032,
        );

        const rDelta = state.browRightDeltaY;
        updateQuadraticTube(
          rightBrowGeo,
          BROW_RINGS,
          BROW_RADIAL,
          inX,
          state.browInnerY + rDelta * 0.5,
          midX,
          state.browMidY + rDelta,
          outX,
          state.browOuterY + rDelta * 0.4,
          0.89,
          0.032,
        );

        // Update 3D Sculpted Mouth + Live Voice Lip-Sync
        const upperY = state.mouthUpperY + voiceOpen * 0.35;
        const lowerY = state.mouthLowerY - voiceOpen * 0.75;
        const gap = upperY - lowerY;
        const isOpen = gap > 0.032;

        updateMouthGeometries(
          upperLipGeo,
          lowerLipGeo,
          mouthCavityGeo,
          MOUTH_RINGS,
          MOUTH_RADIAL,
          state.mouthWidth + voiceOpen * 0.02,
          state.mouthBaseY,
          state.mouthCornerY,
          upperY,
          isOpen ? lowerY : upperY,
          state.mouthAsym,
          0.027,
        );

        lowerLipMesh.visible = isOpen;
        mouthCavityMesh.visible = isOpen;
        tongueMesh.visible = isOpen && gap > 0.09;
        if (tongueMesh.visible) {
          const ty = state.mouthBaseY + lowerY * 0.52;
          projectToSphere(0, ty, 0.866, tongueMesh.position);
        }

        // Head 3D Attitude, Floating & Gentle Pointer Gaze
        const bob = latest.current.reduced
          ? 0
          : Math.sin(elapsedSec * state.bobSpeed) * state.bobAmp;
        const idleSway = latest.current.reduced ? 0 : Math.sin(elapsedSec * 1.15) * 0.035;

        headGroup.position.set(0, bob, 0);
        headGroup.rotation.set(
          state.headPitch - smoothedPointerY * 0.22,
          state.headYaw + idleSway + smoothedPointerX * 0.28,
          state.headRoll + Math.sin(elapsedSec * 0.9) * (latest.current.reduced ? 0 : 0.02),
        );
        headGroup.scale.setScalar(scaleSpring);
      };

      const renderScene = () => {
        if (!renderer || disposed) return;
        renderer.render(scene, camera);
      };

      renderSingle.current = () => {
        const key: Expression = latest.current.expression ?? 'neutral';
        const prof = orbEmotionProfiles[key];
        currTop.copy(getCachedColor(prof.colors.top));
        currMid.copy(getCachedColor(prof.colors.mid));
        currShadow.copy(getCachedColor(prof.colors.shadow));
        currRim.copy(getCachedColor(prof.colors.rim));
        currCheek.copy(getCachedColor(prof.colors.cheek));
        currAuraColor.copy(getCachedColor(prof.colors.aura));
        Object.assign(state, {
          cheekOpacity: prof.cheekOpacity,
          eyeWidth: prof.eyeWidth,
          eyeHeight: prof.eyeHeight,
          eyeTilt: prof.eyeTilt,
          eyeOffsetY: prof.eyeOffsetY,
          browInnerY: prof.browInnerY,
          browMidY: prof.browMidY,
          browOuterY: prof.browOuterY,
          browInward: prof.browInward,
          browRightDeltaY: prof.browRightDeltaY,
          mouthWidth: prof.mouthWidth,
          mouthBaseY: prof.mouthBaseY,
          mouthCornerY: prof.mouthCornerY,
          mouthUpperY: prof.mouthUpperY,
          mouthLowerY: prof.mouthLowerY,
          mouthAsym: prof.mouthAsym,
          headPitch: prof.headPitch,
          headYaw: prof.headYaw,
          headRoll: prof.headRoll,
          bobSpeed: prof.bobSpeed,
          bobAmp: prof.bobAmp,
        });
        headMat.uniforms.uCheekOpacity.value = prof.cheekOpacity;
        scaleSpring = 1.0;
        applyRigGeometry(1.0, 0.0, 0.0);
        renderScene();
      };

      let lastTime = performance.now();
      let elapsedSec = 0;
      let renderAccumMs = 0;

      const onTick = (now: number) => {
        if (disposed || !renderer) return;
        const rawDelta = Math.max(0, (now - lastTime) / 1000);
        lastTime = now;
        const dt = Math.min(rawDelta, 0.05);
        elapsedSec += dt;

        const key: Expression = latest.current.expression ?? 'neutral';
        if (key !== prevExpr) {
          prevExpr = key;
          triggerBounce.current?.();
        }
        const target = orbEmotionProfiles[key];

        if (latest.current.reduced) {
          renderSingle.current?.();
          frame = 0;
          return;
        }

        // Smooth Pointer Gaze
        const ptrAlpha = 1 - Math.exp(-7 * dt);
        smoothedPointerX += (pointerX - smoothedPointerX) * ptrAlpha;
        smoothedPointerY += (pointerY - smoothedPointerY) * ptrAlpha;

        // Smooth Expression Morphing (~220ms)
        const alpha = Math.min(1, 1 - Math.exp(-8.5 * dt));
        state.cheekOpacity += (target.cheekOpacity - state.cheekOpacity) * alpha;
        state.eyeWidth += (target.eyeWidth - state.eyeWidth) * alpha;
        state.eyeHeight += (target.eyeHeight - state.eyeHeight) * alpha;
        state.eyeTilt += (target.eyeTilt - state.eyeTilt) * alpha;
        state.eyeOffsetY += (target.eyeOffsetY - state.eyeOffsetY) * alpha;
        state.browInnerY += (target.browInnerY - state.browInnerY) * alpha;
        state.browMidY += (target.browMidY - state.browMidY) * alpha;
        state.browOuterY += (target.browOuterY - state.browOuterY) * alpha;
        state.browInward += (target.browInward - state.browInward) * alpha;
        state.browRightDeltaY += (target.browRightDeltaY - state.browRightDeltaY) * alpha;
        state.mouthWidth += (target.mouthWidth - state.mouthWidth) * alpha;
        state.mouthBaseY += (target.mouthBaseY - state.mouthBaseY) * alpha;
        state.mouthCornerY += (target.mouthCornerY - state.mouthCornerY) * alpha;
        state.mouthUpperY += (target.mouthUpperY - state.mouthUpperY) * alpha;
        state.mouthLowerY += (target.mouthLowerY - state.mouthLowerY) * alpha;
        state.mouthAsym += (target.mouthAsym - state.mouthAsym) * alpha;
        state.headPitch += (target.headPitch - state.headPitch) * alpha;
        state.headYaw += (target.headYaw - state.headYaw) * alpha;
        state.headRoll += (target.headRoll - state.headRoll) * alpha;
        state.bobSpeed += (target.bobSpeed - state.bobSpeed) * alpha;
        state.bobAmp += (target.bobAmp - state.bobAmp) * alpha;

        const colorAlpha = Math.min(1, 1 - Math.exp(-5.5 * dt));
        currTop.lerp(getCachedColor(target.colors.top), colorAlpha);
        currMid.lerp(getCachedColor(target.colors.mid), colorAlpha);
        currShadow.lerp(getCachedColor(target.colors.shadow), colorAlpha);
        currRim.lerp(getCachedColor(target.colors.rim), colorAlpha);
        currCheek.lerp(getCachedColor(target.colors.cheek), colorAlpha);
        currAuraColor.lerp(getCachedColor(target.colors.aura), colorAlpha);
        headMat.uniforms.uCheekOpacity.value = state.cheekOpacity;

        // Spring Bounce on Emotion Change / Replay
        const springForce = -110 * (scaleSpring - 1.0) - 13.5 * scaleVel;
        scaleVel += springForce * dt;
        scaleSpring += scaleVel * dt;

        // Voice Lip-Sync Ballistics
        const rawVol = latest.current.audioVolume ?? 0;
        const targetVol = rawVol > 0.03 ? Math.min(1, (rawVol - 0.03) / 0.85) : 0;
        const volTau = targetVol > smoothedAudio ? 0.035 : 0.14;
        smoothedAudio += (targetVol - smoothedAudio) * (1 - Math.exp(-dt / volTau));
        const voiceWave =
          smoothedAudio > 0.02
            ? smoothedAudio * (0.065 + 0.035 * Math.sin(elapsedSec * 16.0))
            : 0;
        headMat.uniforms.uAudioGlow.value = smoothedAudio * 0.65;
        auraMat.uniforms.uIntensity.value =
          0.38 + 0.06 * Math.sin(elapsedSec * 2.2) + smoothedAudio * 0.26;

        // Aura Shockwave Ring
        if (pulseAmp > 0.005) {
          pulsePhase += dt * 1.35;
          pulseAmp *= Math.exp(-dt * 3.8);
          auraMat.uniforms.uPulsePhase.value = pulsePhase;
          auraMat.uniforms.uPulseAmp.value = pulseAmp;
        } else {
          pulseAmp = 0;
          auraMat.uniforms.uPulseAmp.value = 0;
        }

        // Natural Blinking Cycle
        let blinkScale = 1.0;
        if (blinkElapsed >= 0) {
          blinkElapsed += dt;
          if (blinkElapsed >= BLINK_DURATION) {
            blinkElapsed = -1;
            nextBlinkAt = elapsedSec + 2.6 + Math.random() * 2.2;
          } else {
            const phase = blinkElapsed / BLINK_DURATION;
            blinkScale = Math.max(0.07, Math.abs(Math.cos(phase * Math.PI)));
          }
        } else if (elapsedSec >= nextBlinkAt) {
          blinkElapsed = 0;
        }

        // Adaptive Frame Rate Budget (60 FPS normal, 24 FPS under heavy ASR CPU load — never unmounts!)
        const targetFrameMs = latest.current.lowPower ? 41.6 : 16.6;
        renderAccumMs += rawDelta * 1000;
        if (renderAccumMs >= targetFrameMs - 1.0) {
          renderAccumMs = 0;
          applyRigGeometry(blinkScale, voiceWave, elapsedSec);
          renderScene();
        }

        frame = requestAnimationFrame(onTick);
      };

      tick = onTick;
      renderSingle.current();
      if (!disposed) latest.current.onReady?.();
      frame = requestAnimationFrame(onTick);
    } catch {
      fail();
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', release);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
      release();
    };
  }, [active]);

  useEffect(() => {
    if (replay > 0) {
      triggerBounce.current?.();
    }
  }, [replay]);

  useEffect(() => {
    if (reduced) {
      renderSingle.current?.();
    }
  }, [expression, reduced]);

  return (
    <div
      ref={host}
      className="face-avatar-canvas"
      aria-hidden="true"
      title="Di chuột để tương tác cùng Khuôn mặt Quả cầu 3D"
      style={{ aspectRatio: '1 / 1' }}
    />
  );
}
