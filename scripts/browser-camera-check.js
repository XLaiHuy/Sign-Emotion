async (page) => {
  const uploads=[];page.on('request',r=>{if(r.method()==='POST')uploads.push(r.url());});
  await page.getByRole('button',{name:'Cài đặt',exact:true}).click();
  await page.getByRole('button',{name:'Camera biểu cảm riêng',exact:true}).click();
  await page.getByRole('checkbox',{name:/Tôi từ 18 tuổi/}).check();
  for(const [name,copy] of [['NotAllowedError','Bạn chưa cấp quyền camera'],['NotFoundError','Không tìm thấy camera'],['NotReadableError','Camera đang được ứng dụng khác']]) {
    await page.evaluate(name=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Test camera error',name);};},name);
    await page.getByRole('button',{name:'Bắt đầu camera',exact:true}).click();
    await page.getByText(copy,{exact:false}).waitFor();
  }
  await page.evaluate(()=>{
    navigator.mediaDevices.getUserMedia=async constraints=>{
      if(constraints.audio!==false)throw new Error('Unexpected microphone request');
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#888';ctx.fillRect(0,0,640,480);
      const stream=canvas.captureStream(5);window.__testStream=stream;window.__testCanvas=canvas;
      return stream;
    };
  });
  await page.getByRole('button',{name:'Bắt đầu camera',exact:true}).click();
  await page.getByText('Đang phân tích trên thiết bị',{exact:true}).waitFor({timeout:55000});
  await page.getByText('Hướng camera về một khuôn mặt',{exact:true}).waitFor();
  await page.getByRole('checkbox',{name:/Tôi từ 18 tuổi/}).uncheck();
  await page.getByText('Camera chưa hoạt động',{exact:true}).waitFor();
  if(!await page.evaluate(()=>window.__testStream.getTracks().every(t=>t.readyState==='ended')))throw new Error('Consent withdrawal left camera tracks live');
  await page.getByRole('checkbox',{name:/Tôi từ 18 tuổi/}).check();
  await page.getByRole('button',{name:'Bắt đầu camera',exact:true}).click();
  await page.getByText('Đang phân tích trên thiết bị',{exact:true}).waitFor({timeout:55000});
  await page.getByRole('button',{name:'Kết thúc phiên',exact:true}).click();
  if(!await page.evaluate(()=>window.__testStream.getTracks().every(t=>t.readyState==='ended')))throw new Error('Camera tracks still live');
  await page.getByRole('button',{name:'Phản hồi của bạn',exact:true}).click();
  await page.getByRole('textbox',{name:/Điều bạn muốn chia sẻ/}).fill('Browser QA — synthetic canvas; not pilot data');
  await page.getByRole('checkbox',{name:/Tôi đồng ý lưu phản hồi/}).check();
  await page.getByRole('button',{name:'Lưu trên thiết bị',exact:true}).click();
  await page.getByText('Chỉ lưu trên thiết bị',{exact:true}).last().waitFor();
  await page.getByRole('button',{name:'Xóa trên thiết bị',exact:true}).last().click();
  await page.getByText('Chưa có phản hồi nào.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Cài đặt',exact:true}).click();
  await page.getByRole('button',{name:'Camera biểu cảm riêng',exact:true}).click();
  await page.getByRole('button',{name:'Bắt đầu camera',exact:true}).click();
  await page.getByText('Đang phân tích trên thiết bị',{exact:true}).waitFor({timeout:55000});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.getByText('Camera chưa hoạt động',{exact:true}).waitFor();
  if(!await page.evaluate(()=>window.__testStream.getTracks().every(t=>t.readyState==='ended')))throw new Error('Background camera tracks still live');
  await page.evaluate(()=>{delete document.hidden;});
  if(uploads.length)throw new Error('Unexpected upload during local camera: '+uploads.join(','));
}
