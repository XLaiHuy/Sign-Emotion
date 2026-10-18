import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Polyfill FileReader for GLTFExporter in Node.js
class FileReaderPolyfill {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (this.onload) this.onload({ target: this });
      if (this.onloadend) this.onloadend({ target: this });
    });
  }
}
globalThis.FileReader = FileReaderPolyfill;

/**
 * Parses raw .npy buffer into Float32Array of frames.
 */
function parseNpy(buffer) {
  const u8 = new Uint8Array(buffer);
  const headerLen =
    u8[6] === 1 ? u8[8] | (u8[9] << 8) : u8[8] | (u8[9] << 8) | (u8[10] << 16) | (u8[11] << 24);
  const offset = (u8[6] === 1 ? 10 : 12) + headerLen;
  return new Float32Array(
    buffer.buffer,
    buffer.byteOffset + offset,
    (buffer.byteLength - offset) / 4,
  );
}

/**
 * Builds a rigged humanoid mannequin avatar with fully articulated arms & fingers.
 */
function createSignMannequin() {
  const bones = [];
  const boneMap = new Map();

  function addBone(name, parent, pos) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.copy(pos);
    if (parent) parent.add(b);
    bones.push(b);
    boneMap.set(name, b);
    return b;
  }

  // Hierarchy
  const root = addBone('root', null, new THREE.Vector3(0, 0, 0));
  const chest = addBone('chest', root, new THREE.Vector3(0, 0.45, 0));
  const neck = addBone('neck', chest, new THREE.Vector3(0, 0.35, 0));
  const head = addBone('head', neck, new THREE.Vector3(0, 0.22, 0));

  // Left arm
  const leftShoulder = addBone('leftShoulder', chest, new THREE.Vector3(0.24, 0.26, 0));
  const leftArm = addBone('leftArm', leftShoulder, new THREE.Vector3(0.16, -0.26, 0));
  const leftForeArm = addBone('leftForeArm', leftArm, new THREE.Vector3(0.12, -0.26, 0));
  const leftHand = addBone('leftHand', leftForeArm, new THREE.Vector3(0.06, -0.22, 0));

  // Left fingers (Thumb, Index, Middle, Ring, Pinky)
  const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
  const fingerOffsets = [
    new THREE.Vector3(0.035, -0.02, 0.025), // Thumb
    new THREE.Vector3(0.025, -0.06, 0.01), // Index
    new THREE.Vector3(0.0, -0.065, 0.005), // Middle
    new THREE.Vector3(-0.025, -0.06, 0.0), // Ring
    new THREE.Vector3(-0.045, -0.05, -0.005), // Pinky
  ];

  for (let fi = 0; fi < fingerNames.length; fi++) {
    const fn = fingerNames[fi];
    const f1 = addBone(`left${fn}1`, leftHand, fingerOffsets[fi]);
    const f2 = addBone(`left${fn}2`, f1, new THREE.Vector3(0, -0.03, 0));
    addBone(`left${fn}3`, f2, new THREE.Vector3(0, -0.025, 0));
  }

  // Right arm
  const rightShoulder = addBone('rightShoulder', chest, new THREE.Vector3(-0.24, 0.26, 0));
  const rightArm = addBone('rightArm', rightShoulder, new THREE.Vector3(-0.16, -0.26, 0));
  const rightForeArm = addBone('rightForeArm', rightArm, new THREE.Vector3(-0.12, -0.26, 0));
  const rightHand = addBone('rightHand', rightForeArm, new THREE.Vector3(-0.06, -0.22, 0));

  // Right fingers
  const rFingerOffsets = [
    new THREE.Vector3(-0.035, -0.02, 0.025),
    new THREE.Vector3(-0.025, -0.06, 0.01),
    new THREE.Vector3(0.0, -0.065, 0.005),
    new THREE.Vector3(0.025, -0.06, 0.0),
    new THREE.Vector3(0.045, -0.05, -0.005),
  ];

  for (let fi = 0; fi < fingerNames.length; fi++) {
    const fn = fingerNames[fi];
    const f1 = addBone(`right${fn}1`, rightHand, rFingerOffsets[fi]);
    const f2 = addBone(`right${fn}2`, f1, new THREE.Vector3(0, -0.03, 0));
    addBone(`right${fn}3`, f2, new THREE.Vector3(0, -0.025, 0));
  }

  const skeleton = new THREE.Skeleton(bones);
  const geoms = [];

  function addPart(geom, boneIndex, offsetPos = new THREE.Vector3()) {
    geom.translate(offsetPos.x, offsetPos.y, offsetPos.z);
    const count = geom.attributes.position.count;
    const skinIndices = [];
    const skinWeights = [];
    for (let i = 0; i < count; i++) {
      skinIndices.push(boneIndex, 0, 0, 0);
      skinWeights.push(1, 0, 0, 0);
    }
    geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    geoms.push(geom);
  }

  // Head
  addPart(
    new THREE.SphereGeometry(0.18, 16, 12),
    bones.indexOf(head),
    new THREE.Vector3(0, 0.1, 0),
  );
  // Neck
  addPart(
    new THREE.CylinderGeometry(0.065, 0.075, 0.15, 10),
    bones.indexOf(neck),
    new THREE.Vector3(0, -0.04, 0),
  );
  // Torso / Chest
  addPart(
    new THREE.CylinderGeometry(0.25, 0.21, 0.45, 12),
    bones.indexOf(chest),
    new THREE.Vector3(0, 0, 0),
  );
  // Shoulders
  addPart(new THREE.SphereGeometry(0.075, 10, 8), bones.indexOf(leftShoulder));
  addPart(new THREE.SphereGeometry(0.075, 10, 8), bones.indexOf(rightShoulder));
  // Upper arms
  addPart(
    new THREE.CylinderGeometry(0.055, 0.048, 0.25, 8),
    bones.indexOf(leftArm),
    new THREE.Vector3(0, -0.12, 0),
  );
  addPart(
    new THREE.CylinderGeometry(0.055, 0.048, 0.25, 8),
    bones.indexOf(rightArm),
    new THREE.Vector3(0, -0.12, 0),
  );
  // Elbow joints
  addPart(
    new THREE.SphereGeometry(0.05, 8, 6),
    bones.indexOf(leftForeArm),
    new THREE.Vector3(0, 0, 0),
  );
  addPart(
    new THREE.SphereGeometry(0.05, 8, 6),
    bones.indexOf(rightForeArm),
    new THREE.Vector3(0, 0, 0),
  );
  // Forearms
  addPart(
    new THREE.CylinderGeometry(0.048, 0.04, 0.25, 8),
    bones.indexOf(leftForeArm),
    new THREE.Vector3(0, -0.12, 0),
  );
  addPart(
    new THREE.CylinderGeometry(0.048, 0.04, 0.25, 8),
    bones.indexOf(rightForeArm),
    new THREE.Vector3(0, -0.12, 0),
  );
  // Wrist joints
  addPart(
    new THREE.SphereGeometry(0.042, 8, 6),
    bones.indexOf(leftHand),
    new THREE.Vector3(0, 0, 0),
  );
  addPart(
    new THREE.SphereGeometry(0.042, 8, 6),
    bones.indexOf(rightHand),
    new THREE.Vector3(0, 0, 0),
  );
  // Palms
  addPart(
    new THREE.BoxGeometry(0.075, 0.08, 0.025),
    bones.indexOf(leftHand),
    new THREE.Vector3(0, -0.04, 0),
  );
  addPart(
    new THREE.BoxGeometry(0.075, 0.08, 0.025),
    bones.indexOf(rightHand),
    new THREE.Vector3(0, -0.04, 0),
  );

  // Finger segments
  for (const side of ['left', 'right']) {
    for (const fn of fingerNames) {
      for (let s = 1; s <= 3; s++) {
        const b = boneMap.get(`${side}${fn}${s}`);
        const idx = bones.indexOf(b);
        const radius = s === 1 ? 0.012 : s === 2 ? 0.01 : 0.009;
        const len = s === 1 ? 0.028 : s === 2 ? 0.024 : 0.02;
        addPart(
          new THREE.CylinderGeometry(radius, radius, len, 6),
          idx,
          new THREE.Vector3(0, -len / 2, 0),
        );
        addPart(new THREE.SphereGeometry(radius * 1.1, 6, 4), idx, new THREE.Vector3(0, 0, 0));
      }
    }
  }

  // Merge geometries
  const posCount = geoms.reduce((acc, g) => acc + g.attributes.position.count, 0);
  const mergedPositions = new Float32Array(posCount * 3);
  const mergedNormals = new Float32Array(posCount * 3);
  const mergedIndices = new Uint16Array(posCount * 4);
  const mergedWeights = new Float32Array(posCount * 4);

  let pOffset = 0;
  for (const g of geoms) {
    const c = g.attributes.position.count;
    mergedPositions.set(g.attributes.position.array, pOffset * 3);
    mergedNormals.set(g.attributes.normal.array, pOffset * 3);
    mergedIndices.set(g.attributes.skinIndex.array, pOffset * 4);
    mergedWeights.set(g.attributes.skinWeight.array, pOffset * 4);
    pOffset += c;
    g.dispose();
  }

  const mergedGeometry = new THREE.BufferGeometry();
  mergedGeometry.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
  mergedGeometry.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
  mergedGeometry.setAttribute('skinIndex', new THREE.BufferAttribute(mergedIndices, 4));
  mergedGeometry.setAttribute('skinWeight', new THREE.BufferAttribute(mergedWeights, 4));

  const material = new THREE.MeshStandardMaterial({
    color: 0x88b090, // SignEmo sage brand color
    roughness: 0.5,
    metalness: 0.1,
  });

  const mesh = new THREE.SkinnedMesh(mergedGeometry, material);
  mesh.name = 'SignAvatar';
  mesh.add(root);
  mesh.bind(skeleton);

  return { root, bones, boneMap, mesh, skeleton };
}

function getRotationBetween(vFrom, vTo) {
  if (vTo.lengthSq() < 1e-6) return new THREE.Quaternion();
  const uFrom = vFrom.clone().normalize();
  const uTo = vTo.clone().normalize();
  return new THREE.Quaternion().setFromUnitVectors(uFrom, uTo);
}

/**
 * Builds AnimationClip from raw .npy keypoints with full arm & finger articulation.
 */
function buildSignClip(clipName, rawFloats, boneMap) {
  const totalFrames = rawFloats.length / 411;
  const fps = 30;
  const duration = totalFrames / fps;
  const times = new Float32Array(totalFrames);
  for (let f = 0; f < totalFrames; f++) times[f] = f / fps;

  const quatTracks = new Map();
  for (const [name] of boneMap) {
    quatTracks.set(name, new Float32Array(totalFrames * 4));
  }

  function getPoint(frame, idx) {
    const x = frame[idx * 3];
    const y = frame[idx * 3 + 1];
    const z = frame[idx * 3 + 2];
    return new THREE.Vector3((x - 0.5) * 1.8, -(y - 0.5) * 1.8, -z * 1.2);
  }

  function getHandPoint(frame, handBase, jointIdx) {
    const base = handBase + jointIdx * 3;
    const x = frame[base];
    const y = frame[base + 1];
    const z = frame[base + 2];
    return new THREE.Vector3((x - 0.5) * 1.8, -(y - 0.5) * 1.8, -z * 1.2);
  }

  const downVec = new THREE.Vector3(0, -1, 0);
  const fingerNames = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
  // MediaPipe hand finger joint index offsets
  const fingerJointIndices = [
    [1, 2, 3, 4], // Thumb
    [5, 6, 7, 8], // Index
    [9, 10, 11, 12], // Middle
    [13, 14, 15, 16], // Ring
    [17, 18, 19, 20], // Pinky
  ];

  for (let f = 0; f < totalFrames; f++) {
    const frame = rawFloats.subarray(f * 411, (f + 1) * 411);

    // Shoulders, elbows, wrists
    const lShoulderPos = getPoint(frame, 9);
    const rShoulderPos = getPoint(frame, 10);
    const lElbowPos = getPoint(frame, 11);
    const rElbowPos = getPoint(frame, 12);
    const lWristPos = getPoint(frame, 13);
    const rWristPos = getPoint(frame, 14);

    // Left Arm
    const lUpperVec = lElbowPos.clone().sub(lShoulderPos);
    const qLShoulder = getRotationBetween(downVec, lUpperVec);

    const lForeVec = lWristPos.clone().sub(lElbowPos);
    const lForeLocal = lForeVec.clone().applyQuaternion(qLShoulder.clone().invert());
    const qLElbow = getRotationBetween(downVec, lForeLocal);

    // Left Hand Palm
    const lHandBase = 285;
    const lHandWrist = getHandPoint(frame, lHandBase, 0);
    const lMiddleMCP = getHandPoint(frame, lHandBase, 9);
    const lPalmVec = lMiddleMCP.clone().sub(lHandWrist);
    const lPalmLocal = lPalmVec
      .clone()
      .applyQuaternion(qLShoulder.clone().multiply(qLElbow).invert());
    const qLHand = getRotationBetween(downVec, lPalmLocal);

    // Right Arm
    const rUpperVec = rElbowPos.clone().sub(rShoulderPos);
    const qRShoulder = getRotationBetween(downVec, rUpperVec);

    const rForeVec = rWristPos.clone().sub(rElbowPos);
    const rForeLocal = rForeVec.clone().applyQuaternion(qRShoulder.clone().invert());
    const qRElbow = getRotationBetween(downVec, rForeLocal);

    // Right Hand Palm
    const rHandBase = 348;
    const rHandWrist = getHandPoint(frame, rHandBase, 0);
    const rMiddleMCP = getHandPoint(frame, rHandBase, 9);
    const rPalmVec = rMiddleMCP.clone().sub(rHandWrist);
    const rPalmLocal = rPalmVec
      .clone()
      .applyQuaternion(qRShoulder.clone().multiply(qRElbow).invert());
    const qRHand = getRotationBetween(downVec, rPalmLocal);

    const storeQuat = (name, q) => {
      const arr = quatTracks.get(name);
      if (!arr) return;
      arr[f * 4] = q.x;
      arr[f * 4 + 1] = q.y;
      arr[f * 4 + 2] = q.z;
      arr[f * 4 + 3] = q.w;
    };

    storeQuat('leftShoulder', qLShoulder);
    storeQuat('leftArm', qLElbow);
    storeQuat('leftHand', qLHand);
    storeQuat('rightShoulder', qRShoulder);
    storeQuat('rightArm', qRElbow);
    storeQuat('rightHand', qRHand);

    // Animate Fingers (Left & Right)
    for (const [side, handBase] of [
      ['left', 285],
      ['right', 348],
    ]) {
      for (let fi = 0; fi < fingerNames.length; fi++) {
        const fn = fingerNames[fi];
        const jIndices = fingerJointIndices[fi];
        // Joint 0 to 1, 1 to 2, 2 to 3
        const p0 = getHandPoint(frame, handBase, jIndices[0]);
        const p1 = getHandPoint(frame, handBase, jIndices[1]);
        const p2 = getHandPoint(frame, handBase, jIndices[2]);
        const p3 = getHandPoint(frame, handBase, jIndices[3]);

        const seg1 = p1.clone().sub(p0);
        const seg2 = p2.clone().sub(p1);
        const seg3 = p3.clone().sub(p2);

        const q1 = getRotationBetween(downVec, seg1);
        const q2 = getRotationBetween(seg1, seg2);
        const q3 = getRotationBetween(seg2, seg3);

        storeQuat(`${side}${fn}1`, q1);
        storeQuat(`${side}${fn}2`, q2);
        storeQuat(`${side}${fn}3`, q3);
      }
    }

    // Default neutral for spine/neck/head
    const idQ = new THREE.Quaternion();
    for (const name of ['root', 'chest', 'neck', 'head', 'leftForeArm', 'rightForeArm']) {
      storeQuat(name, idQ);
    }
  }

  const tracks = [];
  for (const [name, values] of quatTracks) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values));
  }

  return new THREE.AnimationClip(clipName, duration, tracks);
}

export async function convertNpyToSignGlb(npyPath, outGlbPath, clipName = 'Sign') {
  const npyBuf = await readFile(npyPath);
  const floats = parseNpy(npyBuf);
  const { mesh, skeleton, boneMap } = createSignMannequin();

  const clip = buildSignClip(clipName, floats, boneMap);

  const scene = new THREE.Scene();
  scene.add(mesh);

  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      scene,
      async (glb) => {
        try {
          const buf = Buffer.from(glb);
          await writeFile(outGlbPath, buf);
          const hash = createHash('sha256').update(buf).digest('hex');
          resolve({ bytes: buf.byteLength, sha256: hash });
        } catch (e) {
          reject(e);
        }
      },
      (err) => reject(err),
      { binary: true, animations: [clip] },
    );
  });
}

// Generate test models
async function run() {
  await mkdir('public/signs', { recursive: true });
  console.log('Generating SENT001...');
  const res1 = await convertNpyToSignGlb(
    'output/research-assets/vsl-gh/keypoints/SENT001_S01_R01_F.npy',
    'public/signs/SENT001.glb',
    'Sign_SENT001',
  );
  console.log('SENT001:', res1);

  console.log('Generating SENT002...');
  const res2 = await convertNpyToSignGlb(
    'output/research-assets/vsl-gh/keypoints/SENT002_S01_R01_F.npy',
    'public/signs/SENT002.glb',
    'Sign_SENT002',
  );
  console.log('SENT002:', res2);
}

run().catch(console.error);
