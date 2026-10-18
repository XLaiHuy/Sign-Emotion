async (page) => {
  const requests=[];page.on('request',r=>requests.push({method:r.method(),url:r.url(),type:r.resourceType()}));
  await page.getByRole('button',{name:'Cài đặt',exact:true}).click();
  await page.getByRole('button',{name:'Camera biểu cảm riêng',exact:true}).click();
  if(await page.getByRole('button',{name:'Bắt đầu camera',exact:true}).isEnabled())throw new Error('Consent gate missing');
  await page.getByRole('checkbox',{name:/Tôi từ 18 tuổi/}).check();
  if(!await page.getByRole('button',{name:'Bắt đầu camera',exact:true}).isEnabled())throw new Error('Consent not accepted');
  await page.getByRole('button',{name:'Luyện nhịp rung',exact:true}).click();
  if(await page.getByRole('button',{name:'Thử nhịp rung',exact:true}).count()!==4)throw new Error('Missing patterns');
  await page.getByRole('button',{name:'Bắt đầu luyện tập',exact:true}).click();
  await page.getByRole('button',{name:'Phát nhịp',exact:true}).click();
  await page.getByRole('button',{name:'Vui',exact:true}).click();
  await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
  await page.getByRole('button',{name:'Cài đặt',exact:true}).click();
  const slider=page.getByRole('slider').first();await slider.fill('0.8');
  await page.getByRole('button',{name:'Giới thiệu',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow)throw new Error('Horizontal overflow at 390px');
  await page.screenshot({path:'output/playwright/home-mobile.png',fullPage:true});
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:'output/playwright/home-desktop-full.png',fullPage:true});
  const foreign=requests.filter(r=>!r.url.startsWith(new URL(page.url()).origin)&&!r.url.startsWith('blob:')&&!r.url.startsWith('data:'));
  if(foreign.length)throw new Error('Unexpected external request: '+JSON.stringify(foreign));
  if(requests.some(r=>r.method==='POST'))throw new Error('Unexpected upload during local flows');
  console.log(JSON.stringify({check:'consent, practice quiz, settings, mobile layout, no uploads',requests:requests.length,foreign:foreign.length,overflow}));
}
