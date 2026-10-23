import {chromium} from '@playwright/test';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';

const dir=dirname(fileURLToPath(import.meta.url));
const html=resolve(dir,'../../../public/art/maps/prism-quarry/preview.html');
const browser=await chromium.launch({headless:true,executablePath:chromium.executablePath()});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
 const messages=[];
 page.on('pageerror',error=>messages.push(error.message));
 await page.goto(pathToFileURL(html).href);
 await page.locator('.map > img').waitFor({state:'visible'});
 const loaded=await page.locator('.map > img').evaluate(img=>img.complete&&img.naturalWidth===1280);
 if(!loaded)throw Error('Background image not loaded');
 if(await page.locator('#routes path').count()!==8)throw Error('Routes overlay not matching preview schema');
 await page.screenshot({path:resolve(dir,'preview-1366x768.png')});
 await page.getByRole('button',{name:'Только пейзаж'}).click();
 const hidden=await page.locator('#routes').evaluate(node=>getComputedStyle(node).display==='none');
 if(!hidden)throw Error('Route toggle did not hide overlay');
 if(messages.length)throw Error(messages.join('; '));
 console.log('Preview loaded, background native width 1280, routes=8, toggle works, page errors=0.');
}finally{await browser.close();}
