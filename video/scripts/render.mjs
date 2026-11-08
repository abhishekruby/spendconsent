// Local-only render; publication is a separate user action.
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const version=Number(process.argv[2] || 1);
if (!Number.isSafeInteger(version) || version<1) throw Error('Version must be a positive integer');
const edit=JSON.parse(await fs.readFile('src/edit.json','utf8'));
if (!edit.ready) throw Error('Real footage/evidence is incomplete; refusing a final demo render');
const timeline=JSON.parse(await fs.readFile('src/timeline.json','utf8'));
if (timeline.totalFrames>5250 || timeline.fps!==30) throw Error('Invalid final timeline');
await fs.mkdir('.cache/tmp',{recursive:true});
const pidPath=`.cache/render-v${version}.pid`;
try {
  const previous=Number(await fs.readFile(pidPath,'utf8'));
  if(previous>0) {try {process.kill(previous,0);throw Error(`Render ${version} is already running (${previous})`);} catch(error) {if(error.code!=='ESRCH')throw error;}}
} catch(error) {if(error.code!=='ENOENT')throw error;}
await fs.writeFile(pidPath,String(process.pid)+'\n');
// Stop this renderer's descendants too: Chrome starts its own process group.
const descendants=pid=>{let ids;try{ids=readFileSync(`/proc/${pid}/task/${pid}/children`,'utf8').trim().split(/\s+/).filter(Boolean).map(Number);}catch{return [];}return ids.flatMap(id=>[...descendants(id),id]);};
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{for(const pid of descendants(process.pid)){try{process.kill(pid,'SIGTERM');}catch{}}process.exit(signal==='SIGINT'?130:143);});
process.env.TMPDIR=`/proc/${process.pid}/cwd/.cache/tmp`;
process.env.XDG_CACHE_HOME=path.join(root,'.cache');
process.env.UV_CACHE_DIR=path.join(root,'.cache/uv');
process.env.UV_PYTHON_DOWNLOADS='never';
const run=(exe,args)=>new Promise((resolve,reject)=>{
  const child=spawn(exe,args,{stdio:'inherit'});
  child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`${exe} failed (${code})`)));
});
console.log(`Rendering version ${version}: ${timeline.totalFrames/30}s at 1920×1080 / 30 fps`);
await run('node',['scripts/qr.mjs']);
await run('python3',['scripts/export_review.py','--version',String(version)]);
await Promise.all([
  run('uv',['run','--locked','--no-dev','python','scripts/master_audio.py','--version',String(version)]),
  run('node_modules/.bin/remotion',['render','src/index.tsx','SpendConsent',`out/.picture-v${version}.mp4`,
    '--browser-executable=/usr/bin/google-chrome','--codec=h264','--crf=18',
    '--pixel-format=yuv420p','--x264-preset=medium','--concurrency=1','--offthreadvideo-cache-size-in-bytes=536870912','--muted','--log=info']),
]);
await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',`out/.picture-v${version}.mp4`,
  '-i',`out/master-v${version}.wav`,'-map','0:v:0','-map','1:a:0',
  '-vf','scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p',
  '-c:v','libx264','-profile:v','high','-preset','medium','-crf','18','-pix_fmt','yuv420p',
  '-color_range','tv','-colorspace','bt709','-color_trc','bt709','-color_primaries','bt709',
  '-threads','2','-c:a','aac',
  '-b:a','192k','-ar','48000','-t',String(timeline.totalFrames/30),'-movflags','+faststart',
  `out/spendconsent-demo-v${version}.mp4`]);
await run('python3',['scripts/contact_sheet.py',`out/spendconsent-demo-v${version}.mp4`,`out/contact-sheet-v${version}.jpg`]);
await run('python3',['scripts/check_delivery.py','--version',String(version)]);
await fs.writeFile(`out/render-v${version}.complete.json`,JSON.stringify({version,durationSeconds:timeline.totalFrames/30})+'\n');
console.log(`Version ${version} rendered. Review the film, contact sheet and timeline before sharing.`);
