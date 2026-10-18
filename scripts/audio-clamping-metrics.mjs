// Research only. Nothing in the production capture path imports this module.
export function words(text) {
  return (
    text
      .normalize('NFC')
      .toLocaleLowerCase('vi')
      .match(/[\p{L}\p{N}]+/gu) ?? []
  );
}

export function alignment(reference, hypothesis) {
  const rows = reference.length + 1;
  const columns = hypothesis.length + 1;
  const costs = Array.from({ length: rows }, () => new Uint32Array(columns));
  for (let i = 0; i < rows; i++) costs[i][0] = i;
  for (let j = 0; j < columns; j++) costs[0][j] = j;
  for (let i = 1; i < rows; i++)
    for (let j = 1; j < columns; j++)
      costs[i][j] = Math.min(
        costs[i - 1][j] + 1,
        costs[i][j - 1] + 1,
        costs[i - 1][j - 1] + Number(reference[i - 1] !== hypothesis[j - 1]),
      );
  let i = reference.length,
    j = hypothesis.length;
  let substitutions = 0,
    deletions = 0,
    insertions = 0,
    tailDeletions = 0;
  // Tail = last three reference words, a disclosed proxy, not phoneme alignment.
  while (i || j) {
    if (
      i &&
      j &&
      costs[i][j] === costs[i - 1][j - 1] + Number(reference[i - 1] !== hypothesis[j - 1])
    ) {
      substitutions += Number(reference[i - 1] !== hypothesis[j - 1]);
      i--;
      j--;
    } else if (i && costs[i][j] === costs[i - 1][j] + 1) {
      deletions++;
      if (i > reference.length - 3) tailDeletions++;
      i--;
    } else {
      insertions++;
      j--;
    }
  }
  return {
    errors: costs[reference.length][hypothesis.length],
    substitutions,
    deletions,
    insertions,
    tailDeletions,
  };
}

export function score(reference, hypothesis) {
  const ref = words(reference),
    hyp = words(hypothesis);
  if (!ref.length) throw new Error('Nonempty reference required');
  const word = alignment(ref, hyp);
  const characters = alignment([...ref.join(' ')], [...hyp.join(' ')]);
  return {
    ...word,
    referenceWords: ref.length,
    referenceChars: [...ref.join(' ')].length,
    charErrors: characters.errors,
    wer: word.errors / ref.length,
    cer: characters.errors / [...ref.join(' ')].length,
    deletionRate: word.deletions / ref.length,
  };
}

export function clampTail(samples, noiseRms, noiseMeasured, sampleRate = 16000) {
  if (sampleRate !== 16000 || samples.length < 3200 || !samples.every(Number.isFinite))
    throw new Error('Expected finite mono 16-kHz PCM with at least 200 ms');
  const result = samples.slice();
  const start = result.length - 3200;
  let energy = 0;
  for (let i = start; i < result.length; i++) energy += result[i] ** 2;
  const rms = Math.sqrt(energy / 3200);
  // Candidate parameter only: a measured background floor, capped at -40 dBFS.
  // Never infer a floor from the very tail that is being tested.
  const threshold =
    noiseMeasured && Number.isFinite(noiseRms) && noiseRms >= 0
      ? Math.min(0.01, noiseRms * 1.5)
      : 0;
  const applied = threshold > 0 && rms < threshold;
  if (applied) result.fill(0, start);
  return { samples: result, applied, rms, threshold };
}
