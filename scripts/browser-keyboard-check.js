async (page) => {
  const tab=await page.context().newPage();
  try {
    await tab.goto('http://127.0.0.1:4173/');
    await tab.getByRole('heading',{name:/Ở đây, mình hiểu nhau./}).waitFor();
    await tab.keyboard.press('Tab');
    if(!await tab.evaluate(()=>document.activeElement.textContent.includes('Đến nội dung chính')))throw new Error('Skip link not first keyboard stop');
    await tab.keyboard.press('Enter');
    if(!await tab.evaluate(()=>document.activeElement.id==='main'))throw new Error('Skip link did not focus main');
    await tab.keyboard.press('Tab');
    if(!await tab.evaluate(()=>document.activeElement.tagName==='BUTTON'&&getComputedStyle(document.activeElement).outlineStyle!=='none'))throw new Error('Keyboard focus not visible');
    await tab.setViewportSize({width:390,height:844});
    await tab.getByRole('button',{name:'Mở cài đặt',exact:true}).click();
    await tab.getByRole('button',{name:'Quản trị pilot',exact:true}).click();
    await tab.getByRole('heading',{name:'Chưa kết nối Supabase'}).waitFor();
    await tab.getByRole('button',{name:'Hội thoại',exact:true}).click();
    if(await tab.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Mobile horizontal overflow');
    await tab.screenshot({path:'output/playwright/home-mobile.png',fullPage:true});
    await tab.setViewportSize({width:1280,height:900});
    await tab.screenshot({path:'output/playwright/home-desktop-full.png',fullPage:true});
  } finally {await tab.close();}
}
