async function faceProfileCheck(page, origin = 'http://localhost:8082') {
  await page.goto(`${origin}/healthz`);
  await page.evaluate(async () => { for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister(); });
  await page.goto('about:blank');
  await page.goto(`${origin}/healthz?face-parity=1`);
  const report = await page.evaluate(async () => {
    const manifest = await (await fetch('/research/face-parity/manifest.json')).json();
    const html = await (await fetch('/')).text();
    const entry = html.match(/src="([^"]+\.js)"/)[1];
    const source = await (await fetch(entry)).text();
    const workerUrl = source.match(/\/assets\/face-benchmark\.worker-[A-Za-z0-9_-]+\.js/)[0];
    const rows = [];
    for (const fixture of manifest.profiles) {
      const worker = new Worker(workerUrl,{type:'module'});
      try {
        const rgba = new Uint8Array(await (await fetch(fixture.rgba)).arrayBuffer());
        const result = await new Promise((resolve,reject) => {
          const timer = setTimeout(() => reject(new Error('Face probe timeout')),90000);
          worker.onerror = () => { clearTimeout(timer); reject(new Error('Face probe failed')); };
          worker.onmessage = ({data}) => { clearTimeout(timer); if(data.type === 'error') reject(new Error(data.code)); else resolve(data); };
          worker.postMessage({type:'benchmark',profile:fixture.profile,rgba},[rgba.buffer]);
        });
        const timings = result.durations.sort((a,b)=>a-b);
        const difference = Math.max(...result.logits.map((value,index)=>Math.abs(value-fixture.logits[index])));
        rows.push({profile:fixture.profile,sha256:fixture.sha256,runs:timings.length,p50Ms:timings[14],p95Ms:timings[28],pythonP50Ms:fixture.pythonP50Ms,pythonP95Ms:fixture.pythonP95Ms,maxLogitDifference:difference,parityPassed:difference<1e-3});
      } finally { worker.terminate(); }
    }
    return {rows,browser:navigator.userAgent,scope:manifest.scope};
  });
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate(report => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const anchor = document.createElement('a'); anchor.href=url;anchor.download='face-profile-browser.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },report);
  const download = await downloadPromise;
  await download.saveAs('output/research-evaluation/face-profile-browser.json');
  return report;
}
