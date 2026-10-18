async (page) => {
  const context=await page.context().browser().newContext({serviceWorkers:'block'});
  const violations=[];
  const csp="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src https://www.youtube-nocookie.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
  await context.route('http://127.0.0.1:4173/**',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'Content-Security-Policy':csp}});});
  const tab=await context.newPage();tab.on('console',message=>{if(/Content Security Policy|Refused to/.test(message.text()))violations.push(message.text());});
  try {
    await tab.goto('http://127.0.0.1:4173/');
    await tab.getByRole('heading',{name:/Ở đây, mình hiểu nhau./}).waitFor();
    const result=await tab.evaluate(async()=>{
      const source=await(await fetch(document.querySelector('script[type="module"]').getAttribute('src'))).text();
      const path=source.match(/\/assets\/face\.worker-[A-Za-z0-9_-]+\.js/)[0];
      return new Promise((resolve,reject)=>{
        const worker=new Worker(path,{type:'module'});const timeout=setTimeout(()=>{worker.terminate();reject(new Error('CSP worker timeout'));},55000);
        worker.onerror=e=>{clearTimeout(timeout);worker.terminate();reject(new Error(e.message));};
        worker.onmessage=async e=>{
          if(e.data.type==='error'){clearTimeout(timeout);worker.terminate();reject(new Error(e.data.message));}
          if(e.data.type==='ready'){const canvas=new OffscreenCanvas(640,480);const ctx=canvas.getContext('2d');ctx.fillStyle='#888';ctx.fillRect(0,0,640,480);const bitmap=await createImageBitmap(canvas);worker.postMessage({type:'frame',timestamp:performance.now(),bitmap},[bitmap]);}
          if(e.data.type==='result'){clearTimeout(timeout);worker.terminate();resolve(e.data.result);}
        };worker.postMessage({type:'init'});
      });
    });
    if(result.status!=='no-face'||violations.length)throw new Error('CSP failure: '+JSON.stringify(violations));
    await context.route('**/models/face_landmarker.task',route=>route.fulfill({status:404,body:'Test missing model'}));
    await tab.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;canvas.getContext('2d').fillRect(0,0,640,480);window.__testCanvas=canvas;window.__testStream=canvas.captureStream(5);return window.__testStream;};});
    await tab.getByRole('button',{name:'Cài đặt',exact:true}).click();
  await tab.getByRole('button',{name:'Camera biểu cảm riêng',exact:true}).click();
    await tab.getByRole('checkbox',{name:/Tôi từ 18 tuổi/}).check();
    await tab.getByRole('button',{name:'Bắt đầu camera',exact:true}).click();
    await tab.getByRole('alert').filter({hasText:/Không thể khởi chạy AI/}).waitFor({timeout:55000});
    if(!await tab.evaluate(()=>window.__testStream.getTracks().every(t=>t.readyState==='ended')))throw new Error('Missing model did not release camera');
  } finally {await context.close();}
}
