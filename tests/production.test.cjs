const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {chromium,webkit} = require('playwright');
const {handler} = require('../scripts/serve.cjs');
let server, baseURL;
before(async () => { server=http.createServer(handler); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); baseURL=`http://127.0.0.1:${server.address().port}`; });
after(()=>new Promise(resolve=>server.close(resolve)));
for (const [name,engine] of Object.entries({chromium,webkit})) {
  test(`${name}: all production MP4s decode and play, desktop and mobile viewer`, async t => {
    const browser=await engine.launch(name==='chromium' ? {channel:'chrome'} : {});
    t.after(()=>browser.close());
    const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    const page=await context.newPage(); page.setDefaultTimeout(12000);
    const errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',req=>{if(new URL(req.url()).origin!==baseURL) external.push(req.url());});
    await page.goto(baseURL);
    const count=await page.locator('.video-card').count(); assert.equal(count,18);
    assert.equal(await page.locator('video[src]').count(),0);
    for (const section of ['motion','teasers','reels']) {
      await page.locator(`#${section} .media-expand`).first().click();
      const total=await page.locator(`#${section} .video-card`).count();
      for (let index=0;index<total;index++) {
        await page.waitForFunction(()=>document.querySelector('#viewerMedia video')?.currentTime > .05);
        const state=await page.locator('#viewerMedia video').evaluate(v=>({error:v.error?.message,src:v.currentSrc,muted:v.muted,ready:v.readyState}));
        assert.equal(state.error,undefined); assert.ok(state.src.startsWith(baseURL+'/media/')); assert.equal(state.muted,true);
        if(index+1<total) await page.locator('#viewerNext').click();
      }
      await page.locator('#viewerClose').click(); await page.waitForFunction(()=>!history.state?.portfolioViewer);
      assert.equal(await page.locator('#viewerMedia video').count(),0);
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('#heroTeaser').click();
    await page.waitForFunction(()=>document.querySelector('#viewerMedia video')?.currentTime > .05);
    const bounds=await page.locator('#mediaViewer').boundingBox(); assert.ok(bounds.height <= 845);
    await page.locator('#viewerSound').click(); assert.equal(await page.locator('#viewerMedia video').evaluate(v=>v.muted),false);
    await page.locator('#viewerNext').click(); await page.waitForFunction(()=>document.querySelector('#viewerMedia video')?.currentTime > .05);
    assert.equal(await page.locator('#viewerMedia video').evaluate(v=>v.muted),false);
    await page.locator('#viewerClose').click(); await page.waitForFunction(()=>!history.state?.portfolioViewer);
    assert.equal(await page.locator('iframe').count(),0); assert.deepEqual(errors,[]); assert.deepEqual(external,[]);
  });
}
