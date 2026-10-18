import { mkdir, writeFile } from 'node:fs/promises';
import { SphereGeometry, TorusGeometry, BoxGeometry } from 'three';

// Project-authored expression illustration: no human asset, identity or AI model.
const document = {
  asset: { version: '2.0', generator: 'SignEmo authored illustration' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'SignEmo', children: [] }],
  meshes: [],
  accessors: [],
  bufferViews: [],
  buffers: [],
  materials: [
    {
      pbrMetallicRoughness: {
        baseColorFactor: [0.76, 0.83, 0.72, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
    },
    {
      pbrMetallicRoughness: {
        baseColorFactor: [0.12, 0.22, 0.17, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
      },
    },
  ],
};
const bins = [];
let offset = 0;
function geometry(shape, material) {
  const g = shape.toNonIndexed();
  const attributes = {};
  for (const [name, semantic] of [
    ['position', 'POSITION'],
    ['normal', 'NORMAL'],
  ]) {
    const a = g.attributes[name];
    const bytes = Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength);
    const view = document.bufferViews.length;
    document.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    bins.push(bytes);
    offset += bytes.length;
    const accessor = { bufferView: view, componentType: 5126, count: a.count, type: 'VEC3' };
    if (name === 'position') {
      g.computeBoundingBox();
      accessor.min = g.boundingBox.min.toArray();
      accessor.max = g.boundingBox.max.toArray();
    }
    attributes[semantic] = document.accessors.length;
    document.accessors.push(accessor);
  }
  const index = document.meshes.length;
  document.meshes.push({ primitives: [{ attributes, material }] });
  g.dispose();
  shape.dispose();
  return index;
}
const head = geometry(new SphereGeometry(1, 24, 16), 0);
const eye = geometry(new SphereGeometry(0.075, 12, 8), 1);
const brow = geometry(new BoxGeometry(0.34, 0.055, 0.045), 1);
const arc = geometry(new TorusGeometry(0.3, 0.028, 6, 24, Math.PI), 1);
const round = geometry(new TorusGeometry(0.15, 0.028, 6, 20), 1);
const line = geometry(new BoxGeometry(0.48, 0.045, 0.035), 1);
function node(parent, mesh, position, scale = [1, 1, 1], rotation = 0) {
  const i = document.nodes.length;
  document.nodes.push({
    mesh,
    translation: position,
    scale,
    rotation: [0, 0, Math.sin(rotation / 2), Math.cos(rotation / 2)],
  });
  document.nodes[parent].children.push(i);
  return i;
}
for (const label of ['happy', 'sad', 'angry', 'surprised', 'fear', 'disgust', 'neutral']) {
  const parent = document.nodes.length;
  document.nodes.push({ name: `preset_${label}`, children: [] });
  document.nodes[0].children.push(parent);
  node(parent, head, [0, 0, 0], [0.9, 1, 0.72]);
  const wide = label === 'fear' || label === 'surprised';
  for (const x of [-0.31, 0.31]) {
    node(parent, eye, [x, 0.22, 0.69], [1, wide ? 1.6 : 1, 0.45]);
    const tilt =
      label === 'angry'
        ? -Math.sign(x) * 0.3
        : label === 'sad' || label === 'fear'
          ? Math.sign(x) * 0.3
          : label === 'disgust'
            ? Math.sign(x) * 0.15
            : 0;
    node(parent, brow, [x, wide ? 0.52 : 0.42, 0.68], [1, 1, 1], tilt);
  }
  if (label === 'happy') node(parent, arc, [0, -0.18, 0.71], [1, 1, 1], Math.PI);
  else if (label === 'sad') node(parent, arc, [0, -0.55, 0.71], [1, 0.65, 1]);
  else if (wide) node(parent, round, [0, -0.32, 0.72], [label === 'fear' ? 1.6 : 1, 1.25, 1]);
  else node(parent, line, [0, -0.32, 0.73], [1, 1, 1], label === 'disgust' ? -0.18 : 0);
}
const binary = Buffer.concat(bins);
document.buffers.push({ byteLength: binary.length });
let json = Buffer.from(JSON.stringify(document));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + binary.length, 8);
const jh = Buffer.alloc(8);
jh.writeUInt32LE(json.length);
jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(binary.length);
bh.writeUInt32LE(0x004e4942, 4);
await mkdir('public/avatar', { recursive: true });
await writeFile('public/avatar/signemo.glb', Buffer.concat([header, jh, json, bh, binary]));
console.log(`Project avatar: ${28 + json.length + binary.length} bytes; seven static presets`);
