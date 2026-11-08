// V3 only: reviewed540p draft first, then exactly one final1080p composition render.
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const mode=process.argv[2]??'draft';
if(!['draft','final','fingerprint'].includes(mode))throw Error('Use draft, final or fingerprint.');
const plan=JSON.parse(await fs.readFile('src/v3/timeline.json','utf8'));
const assets=JSON.parse(await fs.readFile('src/v3/assets.json','utf8'));
const hash=crypto.createHash('sha256');
for(const name of ['src/v3/film.tsx','src/v3/timeline.json','src/v3/assets.json','src/index.tsx','src/theme.ts','evidence-v3.json','public/soundtrack-v3.wav',...Object.values(assets).map(a=>'public/'+a.src)]){
  hash.update(name);hash.update(await fs.readFile(name));
}
const fingerprint=hash.digest('hex');
if(mode==='fingerprint'){console.log(fingerprint);process.exit(0);}
if(plan.totalFrames>5250||plan.totalFrames<=0)throw Error('Runtime exceeds2:55.');
await fs.mkdir('out/v3',{recursive:true});await fs.mkdir('.cache/tmp',{recursive:true});
if(mode==='final'){
  const review=JSON.parse(await fs.readFile('out/v3/draft-approved.json','utf8'));
  if(review.fingerprint!==fingerprint||!review.visualReviewPassed)throw Error('Review the current540p draft before final rendering.');
  await fs.writeFile('out/v3/final1080-started.json',JSON.stringify({fingerprint,started:new Date().toISOString()}),{flag:'wx'});
}
const pidPath='.cache/render-v3-current.pid';
try{const pid=Number(await fs.readFile(pidPath,'utf8'));if(pid>0){try{process.kill(pid,0);throw Error('Another V3 render is active');}catch(e){if(e.code!=='ESRCH')throw e;}}}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.writeFile(pidPath,String(process.pid));
const descendants=pid=>{let children;try{children=readFileSync('/proc/'+pid+'/task/'+pid+'/children','utf8').trim().split(/\s+/).filter(Boolean).map(Number);}catch{return [];}return children.flatMap(id=>[...descendants(id),id]);};
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{for(const pid of descendants(process.pid)){try{process.kill(pid,'SIGTERM');}catch{}}process.exit(143);});
process.env.TMPDIR='/proc/'+process.pid+'/cwd/.cache/tmp';
process.env.XDG_CACHE_HOME=path.join(root,'.cache');
process.env.UV_CACHE_DIR=path.join(root,'.cache/uv');
process.env.UV_PYTHON_DOWNLOADS='never';
const run=(exe,args)=>new Promise((resolve,reject)=>{const p=spawn(exe,args,{stdio:'inherit'});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(exe+' failed '+c)));});
const tag=mode==='draft'?'v3-draft':'v3';
await fs.writeFile('out/v3/'+mode+'-fingerprint.txt',fingerprint+'\n');
console.log('V3 '+mode+': '+plan.totalFrames/30+'s; '+plan.shots.length+' shots; fingerprint '+fingerprint);
await run('node',['scripts/qr.mjs']);
await run('python3',['scripts/review_v3.py','export']);
await run('node_modules/.bin/remotion',['render','src/index.tsx','SpendConsentV3','out/.picture-'+tag+'.mp4',
 '--scale='+(mode==='draft'?.5:1),'--browser-executable=/usr/bin/google-chrome','--codec=h264',
 '--crf='+(mode==='draft'?23:18),'--pixel-format=yuv420p','--x264-preset='+(mode==='draft'?'fast':'medium'),
 '--concurrency=1','--offthreadvideo-cache-size-in-bytes=402653184','--muted','--log=info']);
await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i','out/.picture-'+tag+'.mp4','-i','out/master-v3.wav',
 '-map','0:v:0','-map','1:a:0','-vf','scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p',
 '-c:v','libx264','-profile:v','high','-preset',mode==='draft'?'fast':'medium','-crf',mode==='draft'?'23':'18',
 '-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_trc','bt709','-color_primaries','bt709',
 '-threads','2','-c:a','aac','-b:a','192k','-ar','48000','-t',String(plan.totalFrames/30),'-movflags','+faststart',
 'out/spendconsent-demo-'+tag+'.mp4']);
await run('python3',['scripts/contact_sheet.py','out/spendconsent-demo-'+tag+'.mp4','out/contact-sheet-'+tag+'.jpg','--interval','1']);
await run('uv',['run','--locked','--no-dev','python','scripts/review_v3.py','check','--mode',mode]);
await fs.writeFile('out/v3/'+mode+'-complete.json',JSON.stringify({fingerprint,mode,duration:plan.totalFrames/30})+'\n');
console.log('V3 '+mode+' complete. Inspect actual frames before approval or delivery.');

