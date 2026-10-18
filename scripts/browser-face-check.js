async (page) => {
  // Public NASA astronaut image distributed as scikit-image's test fixture.
  // Download through the test runner only; never ship or cache participant images.
  const response = await page.request.get('https://raw.githubusercontent.com/scikit-image/scikit-image/v0.19.3/skimage/data/astronaut.png');
  if (!response.ok()) throw new Error('Cannot download public test fixture');
  const data = (await response.body()).toString('base64');
  const result = await page.evaluate(async (data) => {
    const original = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(640,480);
    const ctx=canvas.getContext('2d');
    ctx.drawImage(original,130,15,240,180,0,0,640,480);
    const image = await createImageBitmap(canvas);
    const small = await createImageBitmap(original);
    ctx.fillStyle='#888';ctx.fillRect(0,0,640,480);
    ctx.drawImage(original,130,15,240,180,0,100,320,240);
    ctx.drawImage(original,130,15,240,180,320,100,320,240);
    const multiple = await createImageBitmap(canvas);
    original.close();
    // Exercise repeated frames and abrupt scene changes. The product performs
    // full face detection each frame to avoid stale VIDEO tracking results.
    const frames=[...Array(5).fill(image),...Array(5).fill(multiple),...Array(5).fill(small)];const results=[];
    const main = document.querySelector('script[type="module"]').getAttribute('src');
    const source = await (await fetch(main)).text();
    const workerPath = source.match(/\/assets\/face\.worker-[A-Za-z0-9_-]+\.js/)[0];
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, {type:'module'});
      const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Worker timeout')); },55000);
      worker.onerror = e => { clearTimeout(timeout); worker.terminate(); reject(new Error(e.message)); };
      worker.onmessage = async e => {
        if(e.data.type === 'error') {clearTimeout(timeout);worker.terminate();reject(new Error(e.data.message));}
        if(e.data.type === 'ready' || e.data.type === 'result') {
          if(e.data.type === 'result')results.push(e.data.result);
          const frame=frames.shift();
          if(frame){if(results.length)await new Promise(resolve=>setTimeout(resolve,200));const bitmap=await createImageBitmap(frame);worker.postMessage({type:'frame',timestamp:performance.now(),bitmap},[bitmap]);}
          else{clearTimeout(timeout);worker.terminate();image.close();small.close();multiple.close();resolve(results);}
        }
      };
      worker.postMessage({type:'init'});
    });
  },data);
  if(result.slice(5,10).some(r=>r.status!=='multiple-faces') || result.slice(0,5).some(r=>r.status!=='valid'||r.scores.length!==8||r.scores.some(s=>!Number.isFinite(s))) || result.slice(10).some(r=>r.status!=='poor-quality')) throw new Error('Face pipeline failed: '+JSON.stringify(result));
  await page.evaluate(result=>sessionStorage.setItem('signemo-test-face',JSON.stringify(result)),result);
}
