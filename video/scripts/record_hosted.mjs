// Isolated hosted recording. Only compare/clarify/review writes are permitted.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {installCursor} from './cursor.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
process.env.DISPLAY=':99';process.env.XAUTHORITY=path.join(root,'.cache/xephyr-v2.auth');
await fs.mkdir('.cache/tmp',{recursive:true});await fs.mkdir('raw/v2',{recursive:true});
process.env.TMPDIR=`/proc/${process.pid}/cwd/.cache/tmp`;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const origin='https://spendconsent.ullagecloud.com';
const allowedApi=(method,pathname)=>['GET','HEAD','OPTIONS'].includes(method)||(method==='POST'&&/^\/api\/requests(?:\/[0-9a-f-]+\/(?:clarify|reviews))?\/?$/.test(pathname));
if(process.argv.includes('--check')){
 for(const path of ['/api/requests','/api/requests/1234-abcd/clarify','/api/requests/1234-abcd/reviews'])if(!allowedApi('POST',path))throw Error('Compare/review blocked');
 for(const path of ['/api/requests/1234/pay','/api/requests/1234/approve','/api/orders','/api/refunds'])if(allowedApi('POST',path))throw Error('Financial/authority write allowed');
 process.stdout.write('PASS: hosted recorder allows only comparison/clarification/review writes\n');process.exit(0);
}
const context=await chromium.launchPersistentContext(path.join(root,'.cache/hosted-v2-profile'),{
 executablePath:'/usr/bin/google-chrome',headless:false,viewport:null,
 args:[`--app=${origin}`,'--kiosk','--window-position=0,0','--window-size=1920,1080','--no-first-run','--no-default-browser-check','--disable-session-crashed-bubble']});
await context.addInitScript(installCursor);
await context.route('**/api/**',async route=>{
 const req=route.request(),u=new URL(req.url());
 if(u.origin===origin&&allowedApi(req.method(),u.pathname))return route.continue();
 await route.abort('blockedbyclient');
});
const page=context.pages()[0]||await context.newPage();
await page.goto(origin);await page.evaluate(()=>document.fonts.ready);
const session=await (await page.request.get(origin+'/api/session')).json();
if(session.environment!=='sandbox'||!session.capabilities?.ai_ready)throw Error('Hosted sandbox AI must be ready');
let capture=null,manifest={},started=null;
const say=o=>process.stdout.write(JSON.stringify(o)+'\n');
page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/api/requests'){started=performance.now();if(capture)capture.events.push({event:'compare-start',seconds:(started-capture.start)/1000});}});
page.on('response',async r=>{if(!r.ok()||!new URL(r.url()).pathname.startsWith('/api/'))return;try{const d=await r.json();if(started&&d.id&&d.constraints&&d.status&&d.status!=='COMPARING'){const s=(performance.now()-started)/1000;started=null;if(capture){capture.waitSeconds=s;capture.events.push({event:'compare-ready',status:d.status,seconds:(performance.now()-capture.start)/1000});}say({aiWaitSeconds:s,status:d.status});}}catch{}});
async function stop(){if(!capture)return;const c=capture;capture=null;c.child.stdin.write('q');const code=await new Promise(r=>c.child.on('exit',r));if(code)throw Error('Capture failed');manifest[c.name]={file:`raw/v2/${c.name}.mp4`,elapsedSeconds:(performance.now()-c.start)/1000,waitSeconds:c.waitSeconds,events:c.events};await fs.writeFile('raw/v2/manifest.json',JSON.stringify(manifest,null,2)+'\n');say({stopped:c.name,seconds:manifest[c.name].elapsedSeconds});}
for await(const line of createInterface({input:process.stdin,terminal:false})){
 try{const c=JSON.parse(line);if(c.op==='inspect'){say({text:(await page.locator('body').innerText()).replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email hidden]').replace(/https?:\/\/\S+/g,'[URL hidden]').replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi,'[ID hidden]'),buttons:await page.getByRole('button').allTextContents(),fields:await page.locator('textarea,input').evaluateAll(es=>es.map(e=>({tag:e.tagName,type:e.type,placeholder:e.placeholder})))});}
 else if(c.op==='start'){if(capture||!/^[A-Za-z0-9-]+$/.test(c.name))throw Error('Invalid recording');await page.bringToFront();const log=await fs.open(`raw/v2/${c.name}.ffmpeg.log`,'w');const child=spawn('ffmpeg',['-hide_banner','-nostats','-y','-f','x11grab','-draw_mouse','0','-framerate','30','-video_size','1920x1080','-i',':99.0+0,0','-an','-c:v','libx264','-preset','ultrafast','-crf','16','-threads','2','-pix_fmt','yuv420p',`raw/v2/${c.name}.mp4`],{stdio:['pipe','ignore',log.fd]});await log.close();capture={name:c.name,child,start:performance.now(),events:[]};await pause(700);say({recording:c.name});}
 else if(c.op==='stop')await stop();
 else if(c.op==='new'){if(capture)throw Error('Stop before navigation');await page.goto(origin);say({new:true});}
 else if(c.op==='mark'){if(capture)capture.events.push({event:c.name,seconds:(performance.now()-capture.start)/1000});say({marked:c.name});}
 else if(c.op==='type'){await page.locator('textarea').first().pressSequentially(c.text,{delay:45});say({typed:true});}
 else if(c.op==='click'){const l=c.selector?page.locator(c.selector):page.getByRole(c.role||'button',{name:c.name,exact:true});if(/approve|pay|refund|checkout|cancel order|buy now|complete purchase/i.test(await l.innerText()))throw Error('This recorder is compare/review only');await l.scrollIntoViewIfNeeded();const b=await l.boundingBox();await page.evaluate(async b=>window.__filmMove?.(b.x+b.width/2,b.y+b.height/2),b);await pause(250);await page.evaluate(()=>window.__filmClick?.());await l.click();await pause(700);say({clicked:c.name||c.selector});}
 else if(c.op==='scroll'){await page.evaluate(y=>window.scrollBy({top:y,behavior:'smooth'}),c.y);await pause(1000);say({scrolled:c.y});}
 else if(c.op==='shot'){if(!/^[A-Za-z0-9-]+$/.test(c.name))throw Error('Invalid name');await page.screenshot({path:`out/v2/${c.name}.png`});say({screenshot:c.name});}
 else if(c.op==='quit'){await stop();await context.close();break;}
 else throw Error('Unknown read-only command');
 }catch(e){say({error:String(e).replace(/https?:\/\/\S+/g,'[URL hidden]').slice(0,300)});}
}
