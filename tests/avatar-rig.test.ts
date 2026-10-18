import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mesh } from 'three';
import { expect, it } from 'vitest';
import { avatarPoses, createAvatarRig } from '../src/features/conversation/avatarRig';

it('uses the shipped GLB contract and reuses one finite mouth buffer across seven distinct poses', async () => {
  const bytes = await readFile('public/avatar/signemo.glb');
  const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
  const rig = createAvatarRig(gltf.scene);
  const neutral = gltf.scene.getObjectByName('preset_neutral')!;
  const mouth = neutral.children[5] as Mesh;
  const buffer = mouth.geometry.attributes.position.array;
  const shapes = new Set<string>();
  for (const pose of Object.values(avatarPoses)) {
    rig.apply(pose);
    expect(mouth.geometry.attributes.position.array).toBe(buffer);
    expect(Array.from(buffer).every(Number.isFinite)).toBe(true);
    shapes.add(JSON.stringify(Array.from(buffer)));
  }
  expect(shapes.size).toBe(7);
  expect(gltf.scene.getObjectByName('preset_happy')?.visible).toBe(false);
  rig.dispose();
});
