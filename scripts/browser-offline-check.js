async (page) => {
  await page.getByRole('button',{name:'Giới thiệu',exact:true}).click();
  await page.getByRole('button',{name:/Tải để dùng khi mất mạng|Sẵn sàng ngoại tuyến/}).click();
  await page.getByRole('button',{name:/Sẵn sàng ngoại tuyến/}).waitFor({timeout:55000});
  const state=await page.evaluate(async()=>({controlled:!!navigator.serviceWorker.controller, assets:(await (await caches.open('signemo-models-v1')).keys()).length}));
  if(!state.controlled || state.assets<14)throw new Error('Offline resources incomplete: '+JSON.stringify(state));
  // An intact index is insufficient: removing a CSS precache entry must revoke readiness.
  const removed=await page.evaluate(async()=>{
    for(const name of await caches.keys()){
      if(name==='signemo-models-v1')continue;
      const cache=await caches.open(name),key=(await cache.keys()).find(r=>/\.css(?:\?|$)/.test(r.url));
      if(key){window.__offlineRestore={cache,key,response:await cache.match(key)};await cache.delete(key);return true;}
    }return false;
  });
  if(!removed)throw new Error('No app CSS found for partial-cache regression');
  await page.getByRole('button',{name:/Sẵn sàng ngoại tuyến/}).click();
  await page.getByText('Chưa đủ cache ứng dụng/model. Hãy tải lại trang rồi kiểm tra lại.',{exact:true}).waitFor();
  await page.evaluate(async()=>{const saved=window.__offlineRestore;await saved.cache.put(saved.key,saved.response);delete window.__offlineRestore;});
  await page.getByRole('button',{name:/Tải để dùng khi mất mạng/}).click();
  await page.getByRole('button',{name:/Sẵn sàng ngoại tuyến/}).waitFor({timeout:55000});
  await page.context().setOffline(true);
  try {
    const reopened=await page.context().newPage();
    await reopened.goto('http://127.0.0.1:4173/');
    await reopened.getByRole('heading',{name:/Ở đây, mình hiểu nhau./}).waitFor();
    await reopened.getByRole('button',{name:'Giới thiệu',exact:true}).click();
    await reopened.getByRole('button',{name:/Sẵn sàng ngoại tuyến/}).waitFor();
    const result=await reopened.evaluate(async()=>{
      const main=document.querySelector('script[type="module"]').getAttribute('src');
      const source=await(await fetch(main)).text();const path=source.match(/\/assets\/face\.worker-[A-Za-z0-9_-]+\.js/)[0];
      return new Promise((resolve,reject)=>{
        const worker=new Worker(path,{type:'module'});const timer=setTimeout(()=>{worker.terminate();reject(new Error('Offline worker timeout'));},55000);
        worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(new Error(e.message));};
        worker.onmessage=async e=>{
          if(e.data.type==='error'){clearTimeout(timer);worker.terminate();reject(new Error(e.data.message));}
          if(e.data.type==='ready'){const canvas=new OffscreenCanvas(640,480);const ctx=canvas.getContext('2d');ctx.fillStyle='#888';ctx.fillRect(0,0,640,480);const bitmap=await createImageBitmap(canvas);worker.postMessage({type:'frame',timestamp:performance.now(),bitmap},[bitmap]);}
          if(e.data.type==='result'){clearTimeout(timer);worker.terminate();resolve(e.data.result);}
        };worker.postMessage({type:'init'});
      });
    });
    if(result.status!=='no-face')throw new Error('Offline blank-frame rejection failed');
    await reopened.close();
  } finally {await page.context().setOffline(false);}
}
