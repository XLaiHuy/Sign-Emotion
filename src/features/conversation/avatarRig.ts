import { BufferAttribute, BufferGeometry, Mesh, type Object3D } from 'three';
import type { Expression } from '../../shared/contracts';

// Illustration only: brows, eye height, mouth width/open/curve/skew/y.
export const avatarPoses: Record<Expression, readonly number[]> = {
  neutral: [0, 0, 0.42, 1, 0.24, 0.012, 0, 0, -0.32],
  happy: [0.08, -0.08, 0.43, 0.8, 0.29, 0.025, -0.16, 0, -0.22],
  sad: [0.32, -0.32, 0.43, 0.85, 0.25, 0.012, 0.14, 0, -0.46],
  angry: [-0.38, 0.38, 0.36, 0.65, 0.25, 0.025, 0.08, 0, -0.38],
  surprised: [0, 0, 0.57, 1.65, 0.14, 0.18, 0, 0, -0.34],
  fear: [0.3, -0.3, 0.55, 1.5, 0.23, 0.1, 0.04, 0, -0.38],
  disgust: [-0.12, 0.24, 0.39, 0.7, 0.25, 0.018, 0.04, 0.1, -0.34],
};

/** Reuse GLB head/eyes/brows and a reusable mouth tube; no per-frame geometry allocation. */
export function createAvatarRig(root: Object3D) {
  const neutral = root.getObjectByName('preset_neutral');
  if (!neutral || neutral.children.length !== 6) throw new Error('avatar-contract');
  root.traverse((node) => {
    if (node.name.startsWith('preset_')) node.visible = node === neutral;
  });
  const [, eyeL, browL, eyeR, browR, mouth] = neutral.children;
  if (!(mouth instanceof Mesh)) throw new Error('avatar-contract');
  const segments = 48,
    sides = 6,
    geometry = new BufferGeometry();
  const positions = new Float32Array((segments + 1) * sides * 3);
  const normals = new Float32Array(positions.length),
    indices: number[] = [];
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j,
        b = i * sides + ((j + 1) % sides);
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  const original = mouth.geometry;
  mouth.geometry = geometry;
  mouth.position.set(0, 0, 0);
  mouth.scale.set(1, 1, 1);
  mouth.rotation.set(0, 0, 0);
  mouth.frustumCulled = false;
  return {
    apply(p: readonly number[]) {
      browL.rotation.z = p[0];
      browR.rotation.z = p[1];
      browL.position.y = p[2];
      browR.position.y = p[2];
      eyeL.scale.y = p[3];
      eyeR.scale.y = p[3];
      for (let i = 0; i <= segments; i++) {
        const t = (i / segments) * Math.PI * 2,
          x = Math.sin(t);
        const y = p[8] + Math.cos(t) * p[5] + (1 - x * x) * p[6] + x * p[7];
        const dx = Math.cos(t) * p[4],
          dy = -Math.sin(t) * p[5] - 2 * x * Math.cos(t) * p[6] + Math.cos(t) * p[7];
        const length = Math.hypot(dx, dy) || 1;
        for (let j = 0; j < sides; j++) {
          const angle = (j / sides) * Math.PI * 2,
            offset = (i * sides + j) * 3;
          const nx = (-dy / length) * Math.cos(angle),
            ny = (dx / length) * Math.cos(angle),
            nz = Math.sin(angle);
          positions[offset] = x * p[4] + nx * 0.022;
          positions[offset + 1] = y + ny * 0.022;
          positions[offset + 2] = 0.76 + nz * 0.022;
          normals[offset] = nx;
          normals[offset + 1] = ny;
          normals[offset + 2] = nz;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.normal.needsUpdate = true;
    },
    dispose() {
      original.dispose();
    },
  };
}
