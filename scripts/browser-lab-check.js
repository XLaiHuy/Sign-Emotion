async (page) => {
  const requests=[];const errors=[];page.on('request',r=>{if(r.method()!=='GET')requests.push({method:r.method(),url:r.url(),body:r.postData()});});page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'Cài đặt',exact:true}).click();
  await page.getByLabel('Chế độ nhịp phản hồi').selectOption('visual');
  await page.getByRole('button',{name:'Luyện nhịp rung',exact:true}).click();
  await page.getByRole('button',{name:'Thử nhịp rung',exact:true}).nth(1).click();
  await page.getByText('Đã mô phỏng nhịp',{exact:false}).waitFor();
  await page.getByRole('button',{name:'Cài đặt',exact:true}).click();await page.getByRole('button',{name:'Mở phòng kiểm thử video'}).click();
  if(await page.locator('iframe').count())throw new Error('YouTube loaded before user action');
  // Generate a 2-second grey video. No camera, audio, person, or research data.
  const bytes=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const ctx=canvas.getContext('2d');ctx.fillStyle='#888';ctx.fillRect(0,0,640,480);
    const stream=canvas.captureStream(10),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'}),chunks=[];
    const draw=setInterval(()=>ctx.fillRect(0,0,640,480),90);
    await new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=resolve;recorder.start();setTimeout(()=>recorder.stop(),2000);});clearInterval(draw);stream.getTracks().forEach(t=>t.stop());
    let data=new Uint8Array(await new Blob(chunks).arrayBuffer());
    // MediaRecorder uses unknown segment duration. Add a standard EBML Duration
    // element to the synthetic fixture so deterministic seeking has finite metadata.
    const marker=[0x15,0x49,0xa9,0x66];let at=-1;
    for(let i=0;i<data.length-4;i++)if(marker.every((v,j)=>data[i+j]===v))at=i+4;
    if(at<0)throw new Error('Synthetic WebM has no SegmentInfo');
    let width=1,mask=0x80;while(!(data[at]&mask)){width++;mask>>=1;}
    let size=data[at]&(mask-1);for(let i=1;i<width;i++)size=size*256+data[at+i];
    const end=at+width+size,extra=new Uint8Array(11);extra.set([0x44,0x89,0x88]);new DataView(extra.buffer).setFloat64(3,2000,false);
    const patched=new Uint8Array(data.length+11);patched.set(data.slice(0,end));patched.set(extra,end);patched.set(data.slice(end),end+11);
    let next=size+11;for(let i=width-1;i>=0;i--){patched[at+i]=next&255;next=Math.floor(next/256);}patched[at]|=mask;
    return Array.from(patched);
  });
  await page.getByLabel('Chọn MP4/WebM').setInputFiles({name:'synthetic-blank.webm',mimeType:'video/webm',buffer:Buffer.from(bytes)});
  await page.getByRole('button',{name:'Đánh giá tuần tự 5 mẫu/giây'}).waitFor();
  await page.getByLabel('Bắt đầu (giây)').fill('0');await page.getByLabel('Kết thúc (giây)').fill('2');await page.getByRole('button',{name:'Thêm đoạn',exact:true}).click();
  await page.getByRole('button',{name:'Đánh giá tuần tự 5 mẫu/giây'}).click();await page.getByText('Đã hoàn thành · 10 mẫu',{exact:true}).waitFor({timeout:90000});
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất JSON + confusion matrix'}).click();const download=await downloadPromise;
  const stream=await download.createReadStream(),parts=[];for await(const chunk of stream)parts.push(chunk);const report=JSON.parse(Buffer.concat(parts).toString('utf8'));
  if(report.rows.length!==10||report.rows.some(r=>r.predicted!=='uncertain'||r.trigger!==null))throw new Error('Blank video produced a prediction or haptic');
  if(report.rows.some(r=>'features' in r)||JSON.stringify(report).includes('data:image'))throw new Error('Media/features leaked into ordinary export');
  if(report.summary.perClass.sad.recall!==0||report.summary.uncertainRate!==1)throw new Error('Ground-truth comparison failed');
  await page.getByLabel('Chọn MP4/WebM').setInputFiles({name:'broken.mp4',mimeType:'video/mp4',buffer:Buffer.from('invalid-video')});
  await page.getByText('Không đọc được video. Thử MP4 H.264 hoặc WebM được trình duyệt hỗ trợ.',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);if(overflow)throw new Error('Mobile horizontal overflow');
  await page.screenshot({path:'output/playwright/lab-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'output/playwright/lab-desktop.png',fullPage:true});
  if(requests.length)throw new Error('Unexpected writes/network uploads: '+JSON.stringify(requests));if(errors.length)throw new Error('Page errors: '+errors.join(';'));
  console.log(JSON.stringify({samples:report.rows.length,uncertainRate:report.summary.uncertainRate,mediaUploads:requests.length,mobileOverflow:overflow}));
}
