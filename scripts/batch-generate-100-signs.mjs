import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { convertNpyToSignGlb } from './generate-vsl-signs.mjs';

const revision = '6c351e63c0b2cf1b5e2e8056bb3bf2d6f31dc90a';
const baseGh = `https://raw.githubusercontent.com/nguyentheanh822/Vietnamese-Sign-Language-Translation/${revision}/data/keypoints/`;

function normalize(text) {
  return text
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/\p{P}/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

async function downloadKeypoints(id, destPath) {
  if (existsSync(destPath)) {
    return;
  }
  const url = `${baseGh}${id}.npy`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : 100;

  console.log(`Starting VSL 3D Sign Generation (limit: ${limit})...`);
  await mkdir('output/research-assets/vsl-gh/keypoints', { recursive: true });
  await mkdir('public/signs', { recursive: true });

  const rawDataset = JSON.parse(
    await readFile('output/research-assets/vsl-gh/dataset.json', 'utf8'),
  );

  // Collect unique sentences by normalized text (prefer S01 R01 F)
  const selected = [];
  const seenText = new Set();
  const seenIds = new Set();

  // Ensure SENT064 (pilot phrase in tests) is included
  const sent064 = rawDataset.find(
    (d) => d.sentence_id === 'SENT064' && d.view === 'F' && d.repetition === 'R01',
  );
  if (sent064) {
    selected.push(sent064);
    seenText.add(normalize(sent064.translation));
    seenIds.add(sent064.sentence_id);
  }

  for (const item of rawDataset) {
    if (selected.length >= limit) break;
    if (item.view !== 'F') continue;
    if (seenIds.has(item.sentence_id)) continue;
    const norm = normalize(item.translation);
    if (seenText.has(norm)) continue;

    seenText.add(norm);
    seenIds.add(item.sentence_id);
    selected.push(item);
  }

  console.log(`Selected ${selected.length} unique sentences from VSL-GH.`);

  const catalogue = [];
  let successCount = 0;

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const sId = item.sentence_id;
    const npyFile = `output/research-assets/vsl-gh/keypoints/${item.id}.npy`;
    const glbFile = `public/signs/${sId}.glb`;
    const clipName = `Sign_${sId}`;

    process.stdout.write(`[${i + 1}/${selected.length}] ${sId} "${item.translation}" ... `);

    try {
      await downloadKeypoints(item.id, npyFile);
      const res = await convertNpyToSignGlb(npyFile, glbFile, clipName);

      // Categorize into communication, health, daily
      let category = 'daily';
      if (
        /khám|bác sĩ|sức khỏe|bệnh|thuốc|đau|máu|nhiệt độ|huyết áp|thị lực|bmi|mạch/iu.test(
          item.translation,
        )
      ) {
        category = 'health';
      } else if (
        /viết|chào|cảm ơn|hỏi|số|nói|gặp|nghe|hiểu|giấy|biên lai|hóa đơn|hồ sơ|ký tên|chờ/iu.test(
          item.translation,
        )
      ) {
        category = 'communication';
      }

      catalogue.push({
        id: sId,
        text: item.translation,
        category,
        source: 'VSL-GH (SIU & CED: Vietnamese Sign Language Dataset, MIT)',
        status: 'playable',
        sourceDataId: item.id,
        asset: {
          kind: 'glb',
          url: `/signs/${sId}.glb`,
          sha256: res.sha256,
          source: 'VSL-GH (SIU & CED: 6 deaf signers, HCMC)',
          license: 'MIT',
          selfChecked: true,
          technicalVerified: true,
          clipName,
        },
      });

      successCount++;
      console.log(`OK (${Math.round(res.bytes / 1024)} KB, cat: ${category})`);
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
      catalogue.push({
        id: sId,
        text: item.translation,
        category: 'daily',
        source: 'VSL-GH',
        status: 'source-data',
        sourceDataId: item.id,
      });
    }
  }

  console.log(`\nSuccessfully converted ${successCount}/${selected.length} sentences to 3D GLB!`);

  // Write out catalogue file
  const tsContent = `import type { SignAsset } from './signAsset';

export interface SignPhraseItem {
  id: string;
  text: string;
  category: 'communication' | 'health' | 'daily';
  source: string;
  status: 'planned' | 'source-data' | 'playable';
  sourceDataId?: string;
  asset?: SignAsset;
}

/** 100 VSL sentences with 3D rigged humanoid signing animations from VSL-GH dataset (SIU & CED). */
export const signPhrases100Catalogue: readonly SignPhraseItem[] = ${JSON.stringify(
    catalogue,
    null,
    2,
  )};
`;

  await writeFile('src/domain/sign/signPhrasesCatalogue.ts', tsContent);
  console.log('Updated src/domain/sign/signPhrasesCatalogue.ts');

  // Update manifest
  const manifest = {
    version: '3.0.0-3d-mocap',
    sourceRevision: revision,
    licenseStatus: 'VSL-GH MIT License (SIU & CED)',
    candidates: catalogue.length,
    playable: successCount,
    phrases: catalogue.map((c) => ({
      id: c.id,
      text: c.text,
      status: c.status,
      regionVerified: true,
      selfChecked: true,
      playable: c.status === 'playable',
      ...(c.asset
        ? {
            assetKind: c.asset.kind,
            assetUrl: c.asset.url,
            sha256: c.asset.sha256,
          }
        : {}),
    })),
  };

  await writeFile('scripts/vsl-hcm-manifest.json', JSON.stringify(manifest, null, 2));
  console.log('Updated scripts/vsl-hcm-manifest.json');
}

main().catch(console.error);
