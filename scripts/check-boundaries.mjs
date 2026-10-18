import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory()
          ? files(resolve(dir, e.name))
          : /\.tsx?$/.test(e.name)
            ? [resolve(dir, e.name)]
            : [],
      ),
    )
  ).flat();
}
const graph = new Map();
const failures = [];
for (const file of await files(resolve('src'))) {
  const name = relative(process.cwd(), file).replaceAll('\\', '/');
  const source = await readFile(file, 'utf8');
  const targets = [];
  // Static import edges only; compiler validates syntax/resolution separately.
  for (const match of source.matchAll(/^import\s+(type\s+)?[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/gm)) {
    const spec = match[2];
    if (
      name.startsWith('src/domain/') &&
      ((!spec.startsWith('.') && spec !== 'zod') || /infrastructure|features|app\//.test(spec))
    )
      failures.push(`${name}: domain cannot import ${spec}`);
    if (name.startsWith('src/infrastructure/') && /features|\/app\//.test(spec))
      failures.push(`${name}: infrastructure cannot import ${spec}`);
    if (spec.startsWith('.')) {
      const target = resolve(dirname(file), spec).replace(/\.tsx?$/, '');
      // Type-only imports are erased and may document storage records safely.
      if (!match[1]) targets.push(target);
    }
  }
  graph.set(file.replace(/\.tsx?$/, ''), targets);
}
const visited = new Set();
const active = new Set();
function visit(node, path = []) {
  if (active.has(node)) {
    failures.push(
      `Runtime dependency cycle: ${[...path, node].map((p) => relative(process.cwd(), p)).join(' -> ')}`,
    );
    return;
  }
  if (visited.has(node)) return;
  active.add(node);
  for (const next of graph.get(node) ?? []) visit(next, [...path, node]);
  active.delete(node);
  visited.add(node);
}
for (const node of graph.keys()) visit(node);
if (failures.length) throw new Error(failures.join('\n'));
console.log(`Checked boundaries and runtime import cycles in ${graph.size} modules`);
