// Interactive JSON-lines driver; no credentials or approval tokens enter commands/logs.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installCursor} from './cursor.js';
import {exactCart,boundAttempt,financialControl} from './record-guards.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
await fs.mkdir('.cache/tmp', {recursive:true});
process.env.TMPDIR = `/proc/${process.pid}/cwd/.cache/tmp`;
process.env.XDG_CACHE_HOME = path.join(root, '.cache');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = value => String(value).replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email hidden]')
  .replace(/nonce-[^\s'";]+/g,'nonce-[hidden]')
  .replace(/https?:\/\/\S+/g, '[URL hidden]')
  .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[ID hidden]')
  .replace(/(?:ending in|••|\*\*)\s*\d{4}/gi,'[account hidden]')
  .replace(/\b[A-Z0-9]{13,}\b/g, '[account hidden]');
const say = data => process.stdout.write(JSON.stringify(data) + '\n');
const context = await chromium.launchPersistentContext(path.join(root, '.chrome-profile'), {
  executablePath:'/usr/bin/google-chrome', headless:false, viewport:null,
  args:['--kiosk','--window-size=1920,1080','--window-position=0,0',
    '--no-first-run','--no-default-browser-check','--disable-session-crashed-bubble',
    '--disable-features=TranslateUI'],
});
await context.addInitScript(installCursor);
let page = context.pages()[0] || await context.newPage();
let phone = null, popup = null, latest = null, capture = null, firstPopup = true;
let crashed=false;
page.on('crash',()=>{crashed=true;void stop();say({browserCrashed:true,recording:false});});
page.on('close',()=>{void stop();});
let clips = {}, waitStarted = null, realWait = null;
await context.exposeBinding('__filmAuthDetected',async()=>{
  firstPopup=true;await stop();say({handoffRequired:true,recording:false});
});
const authSelector='input[type=password],input[autocomplete=username],input[autocomplete=one-time-code],input[name=login_email],input[name=login_password]';
async function authVisible(surface) {
  if (!surface || surface.isClosed()) return false;
  for (const frame of surface.frames()) {
    try {
      if (await frame.locator(authSelector).evaluateAll(nodes=>nodes.some(n=>n.getClientRects().length>0))) return true;
    } catch { return true; } // A transitioning surface is not safe to record.
  }
  return false;
}
try { clips=JSON.parse(await fs.readFile('raw/manifest.json','utf8')).clips || {}; } catch {}
const ledgerPath = path.join(root, '.cache/action-ledger.json');
let ledger;
try { ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; ledger = {sandbox:true, attempts:[],refunds:[]}; }
const saveLedger = () => fs.writeFile(ledgerPath, JSON.stringify(ledger,null,2)+'\n', {mode:0o600});

// A PayPal surface is assigned only by the checkout click's explicit page event.
page.on('request', request => {
  if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/requests') {
    waitStarted=performance.now(); latest=null;
  }
});
page.on('response', async response => {
  const url = new URL(response.url());
  if (!url.pathname.startsWith('/api/') || !response.ok()) return;
  try {
    const data = await response.json();
    if (data.status && data.id && data.constraints) {
      latest = data;
      if (waitStarted !== null && data.status !== 'COMPARING') {
        realWait = (performance.now()-waitStarted)/1000;
        waitStarted = null;
      }
    } else if (data.attempt && latest && (!latest.attempt || latest.attempt.id===data.attempt.id || url.pathname.startsWith('/api/approvals/'))) {
      latest.attempt=data.attempt;
    }
  } catch {}
});
await page.goto('http://127.0.0.1:5173');
await page.evaluate(() => document.fonts.ready);

async function target(command) {
  if (command.phone) { if (!phone) throw Error('No owner phone window'); return phone; }
  if (command.popup) {
    if (firstPopup) throw Error('User must finish sign-in handoff first');
    if (!popup || popup.isClosed()) throw Error('No sandbox popup');
    const host = new URL(popup.url()).hostname;
    if (!host.endsWith('.sandbox.paypal.com') && host !== 'sandbox.paypal.com')
      throw Error('Refusing non-sandbox PayPal surface');
    return popup;
  }
  return page;
}
async function click(where, locator) {
  await locator.waitFor({state:'visible'});
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw Error('No visible click target');
  await where.evaluate(async ({x,y}) => window.__filmMove?.(x,y),
    {x:box.x+box.width/2,y:box.y+box.height/2});
  await pause(300);
  await where.evaluate(() => window.__filmClick?.());
  await locator.click();
  await pause(700);
}
function locate(where, command) {
  if (command.label) return where.getByLabel(command.label, {exact:true});
  if (command.selector) return where.locator(command.selector);
  return where.getByRole(command.role || 'button', {name:command.name,exact:command.exact !== false});
}
async function stop() {
  if (!capture) return;
  const current = capture; capture = null;
  clearInterval(current.focusTimer);
  current.child.stdin.write('q');
  const code = await new Promise(resolve => current.child.on('exit', resolve));
  if (code !== 0) throw Error('ffmpeg recording failed; see private recording log');
  clips[current.name] = {file:'raw/'+current.name+'.mp4',elapsedSeconds:(performance.now()-current.start)/1000};
  await fs.writeFile('raw/manifest.json', JSON.stringify({clips,realAIWaitSeconds:realWait},null,2)+'\n');
  return clips[current.name];
}
async function start(name) {
  if (!/^[A-Za-z0-9-]+$/.test(name)) throw Error('Invalid clip name');
  if (capture) throw Error('A clip is already recording');
  if (crashed || page.isClosed()) throw Error('App page is not healthy; no desktop capture started');
  if (firstPopup && popup && !popup.isClosed()) throw Error('No recording during sign-in');
  if (await authVisible(popup)) throw Error('Authentication surface visible; recording remains stopped');
  await (popup && !popup.isClosed() ? popup : page).bringToFront();
  await fs.mkdir('raw',{recursive:true});
  const log = await fs.open('raw/'+name+'.ffmpeg.log','w');
  const child = spawn('ffmpeg',['-hide_banner','-nostats','-y','-f','x11grab',
    '-draw_mouse','0','-framerate','30','-video_size','1920x1080','-i',`${process.env.DISPLAY || ':0'}.0+0,0`,
    '-an','-c:v','libx264','-preset','ultrafast','-crf','16','-threads','2',
    '-pix_fmt','yuv420p','raw/'+name+'.mp4'],{stdio:['pipe','ignore',log.fd]});
  await log.close();
  capture = {child,name,start:performance.now()};
  // X11 records the desktop: keep the intended app surface above the editor.
  capture.focusTimer=setInterval(()=>{
    if (!capture) return;
    const surface=popup && !popup.isClosed() ? popup : page;
    void surface.bringToFront().catch(()=>{void stop();});
  },200);
  await pause(700);
  return {recording:name};
}
async function reserve() {
  exactCart(latest);
  const session=await (await page.request.get('http://127.0.0.1:5173/api/session')).json();
  if (session.environment!=='sandbox' || !session.capabilities?.paypal_ready)
    throw Error('Verified sandbox capability is required');
  if (latest.approval?.status!=='APPROVED') throw Error('Exact cart needs a current approval');
  if (ledger.attempts.length >= 6) throw Error('Six-attempt recording limit reached');
  if (!(await page.locator('body').innerText()).toLowerCase().includes('sandbox'))
    throw Error('Sandbox label missing');
  ledger.attempts.push({number:ledger.attempts.length+1,request:latest.id,review:latest.review.id,total_cents:latest.review.total_cents,
    time:new Date().toISOString(),state:'reserved'});
  await saveLedger();
}
async function command(c) {
  if (c.op === 'inspect') {
    const where = await target(c);
    return {text:clean(await where.locator('body').innerText()).slice(0,6500),
      controls:await where.locator('input:not([type=password]),textarea,select').evaluateAll(nodes => nodes.map(n =>
        ({tag:n.tagName,type:n.type,placeholder:n.getAttribute('placeholder'),label:n.getAttribute('aria-label'),id:n.id}))),
      status:latest?.status, approval:latest?.approval?.status,attempt:latest?.attempt?.state,
      realWait,review:latest?.review ?
        {total_cents:latest.review.total_cents,currency:latest.review.currency,
          created_at:latest.review.created_at,expires_at:latest.review.expires_at}:null};
  }
  if (c.op === 'screenshot') {
    if (!/^[A-Za-z0-9-]+$/.test(c.name)) throw Error('Invalid screenshot name');
    const where = await target(c);
    await where.screenshot({path:'out/'+c.name+'.png'});
    return {saved:'out/'+c.name+'.png'};
  }
  if (c.op === 'click') {
    if (c.popup || /pay|refund|checkout|cancel order|buy now|complete purchase/i.test(c.name || ''))
      throw Error('Use a guarded financial action, not generic click');
    const where = await target(c), locator=locate(where,c);
    if (/pay|refund|checkout|cancel order|buy now|complete purchase/i.test(await locator.innerText()))
      throw Error('Financial button requires a guarded operation');
    await click(where, locator); return {clicked:c.name || c.label || c.selector};
  }
  if (c.op === 'type') {
    if (c.popup || /password|email|otp/i.test(c.label || c.selector || '')) throw Error('Credentials are user-only');
    const where = await target(c), locator = locate(where,c);
    await click(where, locator);
    await locator.fill(''); await locator.pressSequentially(c.text,{delay:45});
    await pause(800); return {typed:true};
  }
  if (c.op === 'wait') { await pause(Math.min(c.ms || 1000,55000)); return {waited:true}; }
  if (c.op === 'scroll') {
    const where=await target(c);
    await where.evaluate(y=>window.scrollBy({top:y,behavior:'smooth'}),c.y || 500);
    await pause(1000); return {scrolled:true};
  }
  if (c.op === 'start') return start(c.name);
  if (c.op === 'stop') return {stopped:await stop()};
  if (c.op === 'ready') {
    const deadline = Date.now()+150000;
    while (!latest || waitStarted!==null || latest.status === 'COMPARING') {
      if (Date.now()>deadline) throw Error('AI did not finish within 150 seconds');
      await pause(500);
    }
    return {status:latest.status,realWait};
  }
  if (c.op === 'bind-order') {
    // Resume the pre-guard checkpoint only when its visible receipt and timing match.
    const review=exactCart(latest), entry=ledger.attempts.at(-1);
    const distance=Math.abs(Date.parse(latest?.attempt?.created_at)-Date.parse(entry?.time));
    if (!Number.isFinite(distance) || !/^[a-f0-9]{8}$/.test(c.requestPrefix || '') || !latest.id.startsWith(c.requestPrefix)
        || !entry || entry.state!=='reserved' || entry.total_cents!==review.total_cents
        || latest.attempt?.state!=='AWAITING_BUYER' || latest.approval?.review_id!==review.id
        || distance>120000)
      throw Error('Existing order does not match the reserved recording checkpoint');
    entry.request=latest.id;entry.review=review.id;entry.attempt=latest.attempt.id;entry.provider_order=latest.attempt.provider_order_id;
    await saveLedger();return {existingOrderBound:true};
  }
  if (c.op === 'stop-order') {
    const entry=ledger.attempts.at(-1);boundAttempt(latest,entry);
    if (latest.attempt.state!=='AWAITING_BUYER' || latest.attempt.pending_operation
        || !latest.attempt.allowed_actions.includes('stop')) throw Error('Attempt cannot safely be stopped');
    await click(page,page.getByRole('button',{name:'Cancel this payment',exact:true}));
    entry.state='stop-requested';await saveLedger();return {savedAttemptStopRequested:true};
  }
  if (c.op === 'owner') {
    // Read authority only into memory; never emit it, pass as argv or persist it.
    const link = await page.getByLabel('Owner approval link',{exact:true}).inputValue();
    const ownerURL = new URL(link);
    if (ownerURL.origin !== 'http://127.0.0.1:5173' || !ownerURL.searchParams.has('approve')) throw Error('Not a local owner link');
    const session = await context.newCDPSession(page);
    const {windowId} = await session.send('Browser.getWindowForTarget');
    await session.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'normal'}});
    await session.send('Browser.setWindowBounds',{windowId,bounds:{left:0,top:0,width:1390,height:1080}});
    const ownerContext=await chromium.launchPersistentContext(path.join(root,'.cache/phone-profile'),{
      executablePath:'/usr/bin/google-chrome',headless:false,
      viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,
      args:['--app=about:blank','--window-position=1410,0','--window-size=510,1080','--no-first-run'],
    });
    await ownerContext.addInitScript(installCursor);
    phone=ownerContext.pages()[0] || await ownerContext.newPage();
    const pcdp=await ownerContext.newCDPSession(phone);
    const ownerWindow=await pcdp.send('Browser.getWindowForTarget');
    await pcdp.send('Browser.setWindowBounds',{windowId:ownerWindow.windowId,bounds:{windowState:'normal'}});
    await pcdp.send('Browser.setWindowBounds',{windowId:ownerWindow.windowId,bounds:{left:1410,top:0,width:510,height:1080}});
    await phone.setViewportSize({width:390,height:844});
    await phone.goto(ownerURL.href);
    return {ownerWindow:true};
  }
  if (c.op === 'fullscreen') {
    if (phone) {await phone.context().close();phone=null;}
    const cdp=await context.newCDPSession(page);
    const {windowId}=await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'fullscreen'}});
    await page.bringToFront(); return {fullscreen:true};
  }
  if (c.op === 'login-preflight') {
    await stop();firstPopup=true;
    popup=await context.newPage();
    await popup.goto('https://www.sandbox.paypal.com/signin',{waitUntil:'domcontentloaded'});
    await popup.addStyleTag({content:'*{cursor:auto!important}#film-cursor{display:none!important}input{filter:none!important}'});
    await pause(1500);
    const required=await authVisible(popup);
    if (!required) {await popup.close();popup=null;await page.bringToFront();}
    return {sandboxLoginRequired:required,recording:false};
  }
  if (c.op === 'login-finished') {
    if (await authVisible(popup)) throw Error('Sandbox sign-in still needs the user');
    if (popup && !popup.isClosed()) await popup.close();popup=null;
    await page.bringToFront();return {loginPreflightFinished:true};
  }
  if (c.op === 'create-order') {
    if (c.exact===false || c.name!=='Start sandbox checkout' || c.popup || c.phone || c.selector || c.label || (c.role && c.role!=='button'))
      throw Error('Creation requires the exact main-app checkout button');
    await stop(); await reserve();
    await click(page,locate(page,c));
    return {sandboxOrderRequested:true,recording:false};
  }
  if (c.op === 'checkout') {
    if (c.exact===false || c.name!=='Continue to PayPal sandbox' || c.popup || c.phone || c.selector || c.label || (c.role && c.role!=='button'))
      throw Error('Only the main-app existing sandbox order may open PayPal');
    await stop(); // Every popup opening is a fresh privacy boundary.
    firstPopup=true;
    const entry=ledger.attempts.at(-1);
    if (!entry || entry.request!==latest?.id || entry.review!==latest?.review?.id
        || entry.total_cents!==latest?.review?.total_cents || entry.state!=='reserved')
      throw Error('No reserved checkout for this exact request');
    if (!latest?.attempt?.id || latest.attempt.state!=='AWAITING_BUYER') throw Error('No existing order awaiting its buyer');
    entry.attempt=latest.attempt.id;entry.provider_order=latest.attempt.provider_order_id; await saveLedger();
    const where=await target(c);
    const result = where.context().waitForEvent('page',{timeout:30000});
    await click(where, locate(where,c));
    popup = await result;
    const pauseForNavigation=async()=>{firstPopup=true;await stop();};
    popup.on('request',request=>{if(request.isNavigationRequest())void pauseForNavigation();});
    await popup.waitForURL(url=>url.hostname==='sandbox.paypal.com' || url.hostname.endsWith('.sandbox.paypal.com'),{timeout:30000});
    const host = new URL(popup.url()).hostname;
    if (!host.endsWith('.sandbox.paypal.com') && host !== 'sandbox.paypal.com') {
      await popup.close(); throw Error('Refused non-sandbox checkout popup');
    }
    const orderToken=new URL(popup.url()).searchParams.get('token');
    if (orderToken && orderToken!==entry.provider_order) {
      await popup.close();throw Error('Sandbox popup does not match the reserved provider order');
    }
    // Login is user-only. Restore the native pointer while recording is off.
    await popup.addStyleTag({content:'*{cursor:auto!important}#film-cursor{display:none!important}'});
    popup.on('framenavigated', async()=>{
      firstPopup=true;await stop();
      if (await authVisible(popup)) say({handoffRequired:true,recording:false});
    });
    popup.on('domcontentloaded',async()=>{
      if (await authVisible(popup)) {firstPopup=true;await stop();say({handoffRequired:true,recording:false});}
    });
    return {sandboxPopup:true,recordingStopped:firstPopup,action:'User signs in manually; do not pay yet. Reply when signed in.'};
  }
  if (c.op === 'signed-in') {
    if (await authVisible(popup)) throw Error('Sign-in is not finished; recording remains stopped');
    await popup.addStyleTag({content:'*{cursor:none!important}#film-cursor{display:block!important}'});
    const cdp=await popup.context().newCDPSession(popup);
    const {windowId}=await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds',{windowId,bounds:{windowState:'fullscreen'}});
    firstPopup=false; return {handoffFinished:true};
  }
  if (c.op === 'financial') {
    if (c.kind==='pay' && firstPopup) throw Error('Sign-in handoff has not finished');
    const where = await target(c);
    if (await authVisible(popup)) {firstPopup=true;await stop();throw Error('Authentication requires the user; recording stopped');}
    const entry=ledger.attempts.at(-1);
    financialControl(c,latest,entry);
    if (c.kind === 'pay') {
      entry.state='payment-click-attempted'; await saveLedger();
    } else if (c.kind === 'refund') {
      if (ledger.refunds.some(r=>r.request===latest.id)) throw Error('Refund already attempted; inspect outcome');
      ledger.refunds.push({request:latest.id,time:new Date().toISOString()}); await saveLedger();
    }
    await click(where,locate(where,c)); return {financialAction:c.kind,attempted:true};
  }
  if (c.op === 'quit') { await stop(); if(phone)await phone.context().close();await context.close(); process.exit(0); }
  throw Error('Unknown operation');
}

say({ready:true,browser:'Chrome kiosk',recording:false});
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
for await (const line of lines) {
  if (!line.trim()) continue;
  try { say(await command(JSON.parse(line))); }
  catch(error) { say({error:clean(error.message).slice(0,400)}); }
}
await stop();
await context.close();
