/* Regression scenarios adapted from the functional reference's playback.test.cjs.
   Synthetic media exercise edge cases; the separate production suite checks real MP4s. */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const { handler } = require('../scripts/serve.cjs');
const root = path.resolve(__dirname, '..');
let server, baseURL;
before(async () => {
  server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
const content = fs.readFileSync(path.join(root, 'content/content.js'), 'utf8');
const fixtureContent = content.replace(/media\/(?:motion|teasers|reels)\/[^']+\.mp4/g, 'tests/fixtures/playback.mp4');
const fixture = fs.readFileSync(path.join(root, 'tests/fixtures/playback.mp4'));
for (const [name, engine] of Object.entries({ chromium, webkit })) {
  test(name, async t => {
    const browser = await engine.launch(name === 'chromium' ? {channel:'chrome'} : {});
    t.after(() => browser.close());
    async function scenario(title, run, options = {}) {
      await t.test(title, async () => {
        const {allowExternal = false, ...contextOptions} = options;
        const context = await browser.newContext({ viewport:{ width:1280, height:800 }, reducedMotion:'reduce', ...contextOptions });
        const page = await context.newPage(); page.setDefaultTimeout(8000);
        const errors = []; const external = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', req => { if (new URL(req.url()).origin !== baseURL) external.push(req.url()); });
        await context.route('**/content/content.js', route => route.fulfill({ contentType:'text/javascript', body:fixtureContent }));
        try { await run(page); assert.deepEqual(errors, []); if (!allowExternal) assert.deepEqual(external, []); }
        catch (error) { console.error(title, error.stack); throw error; }
        finally { await context.close(); }
      });
    }
    await scenario('blocked storage, no startup media requests, safe autoplay denial', async page => {
      await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
      await page.goto(baseURL);
      assert.equal(await page.locator('.video-card').count(), 18);
      assert.equal(await page.locator('video[src]').count(), 0);
      assert.equal(await page.locator('iframe').count(), 0);
      assert.equal(await page.evaluate(() => safePlay({play:() => Promise.resolve()})), true);
      assert.equal(await page.evaluate(() => safePlay({play:() => Promise.reject(Error('Denied'))})), false);
      await page.locator('#heroFeature').click();
      assert.equal(await page.locator('#mediaViewer').evaluate(e => e.open), true);
      await page.getByRole('button', {name:'Close viewer'}).click();
    });
    await scenario('actual playback, keyboard sound, seek, viewer handoff and focus restoration', async page => {
      await page.goto(baseURL);
      const card = page.locator('.video-card').first();
      await card.locator('.media-play').click();
      await page.waitForFunction(() => document.querySelector('.video-card video').currentTime > 0);
      assert.equal(await card.locator('.media-play').getAttribute('aria-label'), 'Pause Americana');
      await card.locator('.media-sound').focus(); await page.keyboard.press('Enter');
      assert.equal(await card.locator('video').evaluate(v => v.muted), false);
      assert.equal(await card.locator('video').evaluate(v => v.paused), false);
      await card.locator('.media-play').click();
      assert.equal(await card.locator('video').evaluate(v => v.paused), true);
      await card.locator('.media-progress').fill('40');
      assert.ok(await card.locator('video').evaluate(v => v.currentTime) > 1);
      await card.locator('.media-expand').focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#viewerMedia video')?.currentTime > 1);
      assert.equal(await page.locator('#viewerMedia video').evaluate(v => v.controls), true);
      assert.equal(await page.locator('#viewerMedia video').evaluate(v => v.muted), false);
      assert.equal(await card.locator('video').evaluate(v => v.paused), true);
      await page.locator('#viewerPlay').click();
      assert.equal(await page.locator('#viewerMedia video').evaluate(v => v.paused), true);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !history.state?.portfolioViewer);
      assert.equal(await page.locator('#viewerMedia').evaluate(e => e.childElementCount), 0);
      assert.equal(await page.evaluate(() => document.activeElement.className), 'media-expand');
      assert.equal(await page.evaluate(() => localStorage.getItem('salmaa:sound-preference')), 'unmuted');
    });
    await scenario('autoplay is exclusive, muted, respects pause and stops offscreen', async page => {
      await page.goto(baseURL);
      await page.locator('#motion-label').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => [...document.querySelectorAll('.video-card video')].filter(v => !v.paused).length === 1);
      assert.equal(await page.locator('.video-card.is-playing video').evaluate(v => v.muted), true);
      await page.locator('.video-card.is-playing .media-play').click();
      await page.waitForTimeout(350);
      assert.equal(await page.locator('video').evaluateAll(vs => vs.filter(v => !v.paused).length), 0);
      await page.locator('#heroSection').scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      assert.equal(await page.locator('video').evaluateAll(vs => vs.filter(v => !v.paused).length), 0);
    }, { reducedMotion:'no-preference' });
    await scenario('manual playback wins over previews and backgrounding pauses the viewer', async page => {
      await page.goto(baseURL);
      const cards = page.locator('#motion .video-card');
      await cards.nth(1).locator('.media-play').click();
      await page.waitForFunction(() => document.querySelectorAll('#motion video')[1].currentTime > 0);
      await page.evaluate(() => { visibleRecords.set(mediaRecords[0], 1); scheduleAutoplay(); });
      await page.waitForTimeout(250);
      assert.equal(await cards.nth(1).locator('video').evaluate(v => v.paused), false);
      assert.equal(await cards.first().locator('video').evaluate(v => v.paused), true);
      await cards.nth(1).locator('.media-expand').click();
      await page.waitForFunction(() => document.querySelector('#viewerMedia video')?.currentTime > 0);
      await page.evaluate(() => pausePageMedia());
      assert.equal(await page.locator('#viewerMedia video').evaluate(v => v.paused), true);
      await page.locator('#viewerClose').click();
    }, { reducedMotion:'no-preference' });
    await scenario('reduced motion and save-data disable autoplay', async page => {
      await page.addInitScript(() => Object.defineProperty(navigator, 'connection', {value:{saveData:true, effectiveType:'4g'}}));
      await page.goto(baseURL);
      await page.locator('#motion-label').scrollIntoViewIfNeeded();
      await page.waitForTimeout(350);
      assert.equal(await page.locator('video[src]').count(), 0);
      await page.locator('.media-play').first().click();
      await page.waitForFunction(() => document.querySelector('.video-card video').currentTime > 0);
    }, { reducedMotion:'no-preference' });
    await scenario('mobile bounds, keyboard/swipe navigation, native-control keys and browser Back', async page => {
      await page.goto(baseURL);
      for (const width of [320,375,390,768,1440]) {
        await page.setViewportSize({width, height:844});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}`);
      }
      await page.setViewportSize({width:390, height:844});
      await page.locator('#heroFeature').click();
      const bounds = await page.locator('#mediaViewer').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.y + bounds.height <= 845);
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#viewerCounter').textContent(), '02 / 03');
      await page.locator('#viewerMedia').dispatchEvent('pointerdown', {pointerId:1, isPrimary:true, clientX:300, clientY:200});
      await page.locator('#viewerMedia').dispatchEvent('pointerup', {pointerId:1, isPrimary:true, clientX:100, clientY:205});
      assert.equal(await page.locator('#viewerCounter').textContent(), '03 / 03');
      await page.locator('#viewerMedia video').focus(); await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator('#viewerCounter').textContent(), '03 / 03');
      await page.goBack();
      assert.equal(await page.locator('#mediaViewer').evaluate(e => e.open), false);
      assert.equal(await page.locator('#viewerMedia video').count(), 0);
      assert.equal(await page.locator('body').evaluate(e => e.classList.contains('viewer-open')), false);
      assert.equal(await page.locator('#heroFeature').evaluate(e => document.activeElement === e), true);
    });
    await scenario('failed video retries successfully', async page => {
      let fail = true;
      await page.route('**/tests/fixtures/playback.mp4', route => fail ? route.fulfill({status:404, body:''}) : route.continue());
      await page.goto(baseURL);
      const card = page.locator('.video-card').first();
      await card.locator('.media-play').click();
      await card.locator('.media-error').waitFor({state:'visible'});
      fail = false;
      await card.locator('.media-play').click();
      await page.waitForFunction(() => document.querySelector('.video-card video')?.currentTime > 0);
      assert.equal(await card.locator('.media-error').isHidden(), true);
    });
    await scenario('drag never plays a card; normal vertical scrolling and rail buttons work', async page => {
      await page.goto(baseURL);
      await page.locator('#teasers-label').scrollIntoViewIfNeeded();
      const box = await page.locator('#teasers .video-card').first().boundingBox();
      await page.mouse.move(box.x+150, box.y+40); await page.mouse.down();
      await page.mouse.move(box.x+20, box.y+40, {steps:10}); await page.mouse.up();
      assert.equal(await page.locator('video[src]').count(), 0);
      const before = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0,300); await page.waitForFunction(y => scrollY > y, before);
      await page.getByRole('button', {name:'Next Reels & work videos'}).click();
      await page.waitForFunction(() => document.querySelector('#reels-rail').scrollLeft > 0);
      await page.locator('#reels-rail').focus(); await page.keyboard.press('ArrowRight');
    });
    await scenario('accessibility checks and contact destinations', async page => {
      await page.goto(baseURL);
      for (const width of [1440,390]) {
        await page.setViewportSize({width,height:900});
        const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
        assert.deepEqual(results.violations.map(v => ({id:v.id, nodes:v.nodes.map(n => n.target)})), []);
      }
      assert.equal(await page.locator('.email-link').getAttribute('href'), 'mailto:salmasayed2811@gmail.com');
      assert.equal(await page.locator('.contact a[href^="https://wa.me"]').getAttribute('href'), 'https://wa.me/201128051982');
      assert.equal(await page.locator('.contact a[href^="tel:"]').getAttribute('href'), 'tel:+201128051982');
      await page.locator('#heroFeature').click();
      await page.locator('#viewerPlay').click();
      const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(results.violations.map(v => ({id:v.id, nodes:v.nodes.map(n => n.target)})), []);
      await page.locator('#viewerClose').click();
    });
    await scenario('retained YouTube/Vimeo handling is on-demand and disposable', async page => {
      await page.goto(baseURL);
      for (const embed of ['youtube','vimeo']) {
        await page.route(embed === 'youtube' ? '**/www.youtube-nocookie.com/**' : '**/player.vimeo.com/**', route => route.fulfill({contentType:'text/html', body:'<html></html>'}));
        // Test the retained adapter with synthetic IDs only; production uses local files.
        await page.evaluate(provider => {
          const section = {id:'adapter-test',title:'Adapter test',type:provider,items:[{id:provider === 'youtube' ? 'test-video' : '123456',title:'Adapter test'}]};
          const record = createRemoteRecord({...section.items[0],embed:provider,poster:'media/posters/XN4P5rIAQjU.jpg'},section,false,document.querySelector('.video-track'));
          sectionRecords.set(section.id,[record]); openViewer(record);
        }, embed);
        const src = await page.locator('#viewerMedia iframe').getAttribute('src');
        assert.ok(src.includes('autoplay=1')); assert.ok(src.includes('playsinline=1')); assert.ok(!src.includes('background=1'));
        await page.evaluate(() => pausePageMedia()); assert.equal(await page.locator('iframe').count(),0);
        await page.getByRole('button',{name:'Retry loading media'}).click();
        assert.equal(await page.locator('#viewerMedia iframe').count(),1);
        await page.locator('#viewerClose').click();
        await page.waitForFunction(() => !history.state?.portfolioViewer);
        assert.equal(await page.locator('iframe').count(),0);
      }
    }, {allowExternal:true});
  });
}
