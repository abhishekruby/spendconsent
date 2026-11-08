// URL comes over a private pipe, not process arguments or logs.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
let url='';
for await (const chunk of process.stdin) url+=chunk;
try {
  const parsed=new URL(url);
  if (parsed.origin!=='http://127.0.0.1:5173' || !parsed.searchParams.has('approve')) throw Error();
  await fs.mkdir('.cache/tmp',{recursive:true});
  process.env.TMPDIR=`/proc/${process.pid}/cwd/.cache/tmp`;
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:false,
    args:['--app=about:blank','--window-position=1420,0','--window-size=500,1000','--no-first-run']});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true});
  const page=await context.newPage();
  await page.goto(parsed.href,{waitUntil:'networkidle'});
  await page.waitForTimeout(5000);
  await browser.close();
} catch { process.exitCode=1; }
