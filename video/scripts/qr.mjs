import QRCode from 'qrcode';
import fs from 'node:fs/promises';
await fs.mkdir('public',{recursive:true});
await QRCode.toFile('public/end-qr.png','https://spendconsent.ullagecloud.com',{
  width:480,margin:3,errorCorrectionLevel:'M',color:{dark:'#1a1714',light:'#f3efe7'},
});
