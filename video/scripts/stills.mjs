// Render chosen frames of the film as JPEGs (one bundle), to inspect shots before a full render.
// Usage: node scripts/stills.mjs <outDir> <frame> [frame...]
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
const [out, ...frames] = process.argv.slice(2);
const serveUrl = await bundle({entryPoint: path.resolve('src/index.tsx')});
const browser = await openBrowser('chrome', {browserExecutable: '/usr/bin/google-chrome'});
const composition = await selectComposition({serveUrl, id: 'SpendConsentV3', puppeteerInstance: browser});
for (const f of frames.map(Number)) {
  await renderStill({composition, serveUrl, frame: f, output: `${out}/f${String(f).padStart(4, '0')}.jpg`, imageFormat: 'jpeg', scale: 0.5, puppeteerInstance: browser, browserExecutable: '/usr/bin/google-chrome'});
}
await browser.close({silent: true});
